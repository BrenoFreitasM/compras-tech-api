import { Types } from 'mongoose';
import { FornecedorModel } from '../models/FornecedorModel';
import { ProdutoDisponivelModel } from '../models/ProdutoDisponivelModel';
import { normalizeBattery, parsePrecoBRL } from './productNormalizer';
import { ProdutoCatalogoService } from './produtoCatalogoService';
import type { ProdutoExtraido } from './productExtractor';

export interface RemetenteWebhook {
  remoteJid: string;
  nome?: string | null;
}

export interface OrigemMensagem {
  messageId: string;
  timestamp: Date;
  groupJid: string | null;
  groupName: string | null;
}

export interface ResumoIngestao {
  fornecedorId: string;
  produtosNovos: number;
  produtosExistentes: number;
  ofertasCriadas: number;
  ofertasAtualizadas: number;
  ofertasDesativadas: number;
  falhas: number;
}

export class ProductIngestService {
  constructor(private readonly catalogo: ProdutoCatalogoService = new ProdutoCatalogoService()) {}

  /**
   * Fluxo do webhook:
   *   lista extraída -> upsert Fornecedor -> para cada item: resolve Produto (catálogo)
   *   -> upsert ProdutoDisponivel (fornecedor + produto + condição + bateria) -> desativa ofertas vencidas.
   *
   * Itens são processados em sequência de propósito: dois itens da mesma lista que apontam para o
   * mesmo produto novo não podem disputar a criação.
   */
  async processarLista(
    itens: ProdutoExtraido[],
    remetente: RemetenteWebhook,
    origem: OrigemMensagem,
  ): Promise<ResumoIngestao> {
    const fornecedor = await this.upsertFornecedor(remetente);

    const resumo: ResumoIngestao = {
      fornecedorId: fornecedor._id.toString(),
      produtosNovos: 0,
      produtosExistentes: 0,
      ofertasCriadas: 0,
      ofertasAtualizadas: 0,
      ofertasDesativadas: 0,
      falhas: 0,
    };

    for (const item of itens) {
      try {
        const { produto, criado } = await this.catalogo.resolver(item);
        criado ? resumo.produtosNovos++ : resumo.produtosExistentes++;

        const novaOferta = await this.upsertOferta(fornecedor._id, produto._id, item, origem);
        novaOferta ? resumo.ofertasCriadas++ : resumo.ofertasAtualizadas++;
      } catch (error) {
        // Um item ruim não pode derrubar o restante da lista.
        resumo.falhas++;
        console.error(`❌ Falha ao processar item "${item.modelo}" de ${remetente.remoteJid}:`, error);
      }
    }

    resumo.ofertasDesativadas = await this.desativarOfertasVencidas(fornecedor._id);
    return resumo;
  }

  private async upsertFornecedor(remetente: RemetenteWebhook) {
    const telefone = remetente.remoteJid.split('@')[0].split(':')[0].replace(/\D/g, '') || null;

    return FornecedorModel.findOneAndUpdate(
      { remoteJid: remetente.remoteJid },
      {
        $set: {
          ultimaMensagemEm: new Date(),
          ...(remetente.nome ? { nome: remetente.nome } : {}),
        },
        $setOnInsert: { remoteJid: remetente.remoteJid, telefone, ativo: true },
      },
      { upsert: true, new: true },
    );
  }

  /** Retorna true se a oferta foi criada, false se apenas atualizada. */
  private async upsertOferta(
    fornecedorId: Types.ObjectId,
    produtoId: Types.ObjectId,
    item: ProdutoExtraido,
    origem: OrigemMensagem,
  ): Promise<boolean> {
    const agora = new Date();
    const condicao = item.condicao ?? null;
    const saudeBateria = normalizeBattery(item.saude_bateria);

    const resultado = await ProdutoDisponivelModel.updateOne(
      { fornecedorId, produtoId, condicao, saudeBateria },
      {
        $set: {
          preco: parsePrecoBRL(item.preco),
          precoTexto: item.preco ?? null,
          observacoes: item.observacoes ?? null,
          status: 'disponivel',
          groupJid: origem.groupJid,
          groupName: origem.groupName,
          messageId: origem.messageId,
          timestamp: origem.timestamp,
          payloadBruto: item,
          ultimaVistaEm: agora,
        },
        $setOnInsert: { primeiraVistaEm: agora },
      },
      { upsert: true },
    );

    return resultado.upsertedCount > 0;
  }

  /**
   * Mantém a regra anterior: ofertas do fornecedor cuja mensagem é anterior a hoje deixam de valer
   * quando ele publica uma nova lista. Ofertas re-listadas hoje já tiveram o timestamp atualizado.
   */
  private async desativarOfertasVencidas(fornecedorId: Types.ObjectId): Promise<number> {
    const inicioDoDia = new Date();
    inicioDoDia.setHours(0, 0, 0, 0);

    const resultado = await ProdutoDisponivelModel.updateMany(
      { fornecedorId, status: 'disponivel', timestamp: { $lt: inicioDoDia } },
      { $set: { status: 'indisponivel' } },
    );
    return resultado.modifiedCount;
  }
}
