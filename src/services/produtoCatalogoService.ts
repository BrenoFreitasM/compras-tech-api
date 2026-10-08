import mongoose from 'mongoose';
import { CategoryModel } from '../models/CategoryModel';
import { IProduto, ProdutoModel } from '../models/ProdutoModel';
import {
  buildChaveCanonica,
  buildNomeBusca,
  buildNomeNormalizado,
  hardTokens,
  normalizeColor,
  normalizeStorage,
  similarity,
} from './productNormalizer';
import type { ProdutoExtraido } from './productExtractor';

export type MetodoMatch = 'exata' | 'alternativa' | 'fuzzy' | 'ia' | 'novo';

export interface ResolucaoProduto {
  produto: IProduto;
  metodo: MetodoMatch;
  criado: boolean;
  score: number;
}

/**
 * Ponto de extensão para o desempate "inteligente" (LLM e/ou busca vetorial).
 * Só é chamado quando o match determinístico/fuzzy ficou na zona cinzenta, então o custo
 * (tokens/embeddings) fica restrito a uma pequena fração dos itens.
 * Retorne o candidato escolhido, ou null se NENHUM for o mesmo produto.
 */
export interface SemanticProductResolver {
  resolve(item: ProdutoExtraido, candidatos: IProduto[]): Promise<IProduto | null>;
}

const AUTO_MATCH_SCORE = 0.85; // acima disso o fuzzy é aceito sem IA
const REVIEW_SCORE = 0.7; // entre REVIEW e AUTO -> zona cinzenta (IA, se configurada)
const MAX_CANDIDATES_FOR_AI = 5;

export class ProdutoCatalogoService {
  constructor(private readonly semanticResolver?: SemanticProductResolver) {}

  /**
   * Encontra o produto base correspondente ao item recebido ou cria um novo.
   * Ordem (do mais barato/confiável para o mais caro):
   *  1. chave canônica exata (ou chave alternativa já aprendida)
   *  2. fuzzy restrito (mesmo armazenamento/cor, mesmos tokens de variante: Pro/Max/números)
   *  3. resolvedor semântico opcional (IA/vetores) na zona cinzenta
   *  4. criação de novo produto (upsert atômico pela chave canônica)
   */
  async resolver(item: ProdutoExtraido): Promise<ResolucaoProduto> {
    const nomeNormalizado = buildNomeNormalizado(item.modelo, item.versao);
    const armazenamentoNormalizado = normalizeStorage(item.armazenamento);
    const corNormalizada = normalizeColor(item.cor);
    const chave = buildChaveCanonica(nomeNormalizado, armazenamentoNormalizado, corNormalizada);
    const aliasBruto = [item.modelo, item.versao].filter(Boolean).join(' ').trim();

    // 1. Match exato
    const exato = await ProdutoModel.findOne({ $or: [{ chaveCanonica: chave }, { chavesAlternativas: chave }] });
    if (exato) {
      const metodo: MetodoMatch = exato.chaveCanonica === chave ? 'exata' : 'alternativa';
      await this.registrarAlias(exato._id, aliasBruto);
      return { produto: exato, metodo, criado: false, score: 1 };
    }

    // 2. Fuzzy: candidatos com os mesmos atributos duros (armazenamento e cor)
    const candidatos = await ProdutoModel.find({
      armazenamentoNormalizado,
      corNormalizada,
    });

    const hardAlvo = hardTokens(nomeNormalizado);
    const pontuados = candidatos
      .filter((c) => hardTokens(c.nomeNormalizado) === hardAlvo)
      .map((produto) => ({ produto, score: similarity(nomeNormalizado, produto.nomeNormalizado) }))
      .sort((a, b) => b.score - a.score);

    const melhor = pontuados[0];
    if (melhor && melhor.score >= AUTO_MATCH_SCORE) {
      await this.aprenderVariacao(melhor.produto._id, chave, aliasBruto);
      return { produto: melhor.produto, metodo: 'fuzzy', criado: false, score: melhor.score };
    }

    // 3. Zona cinzenta -> IA/vetores (opcional)
    if (this.semanticResolver) {
      const duvidosos = pontuados
        .filter((p) => p.score >= REVIEW_SCORE)
        .slice(0, MAX_CANDIDATES_FOR_AI)
        .map((p) => p.produto);

      if (duvidosos.length > 0) {
        const escolhido = await this.semanticResolver.resolve(item, duvidosos);
        if (escolhido) {
          await this.aprenderVariacao(escolhido._id, chave, aliasBruto);
          return { produto: escolhido, metodo: 'ia', criado: false, score: 1 };
        }
      }
    }

    // 4. Sem correspondência -> cria no catálogo
    return this.criar(item, {
      chave,
      nomeNormalizado,
      armazenamentoNormalizado,
      corNormalizada,
      aliasBruto,
    });
  }

  private async criar(
    item: ProdutoExtraido,
    ctx: {
      chave: string;
      nomeNormalizado: string;
      armazenamentoNormalizado: string | null;
      corNormalizada: string | null;
      aliasBruto: string;
    },
  ): Promise<ResolucaoProduto> {
    const categoriaId = await this.resolverCategoria(item.categoria);

    const dadosIniciais = {
      categoriaId,
      modelo: item.modelo.trim(),
      versao: item.versao?.trim() || null,
      armazenamento: ctx.armazenamentoNormalizado,
      cor: item.cor?.trim() || null,
      nomeNormalizado: ctx.nomeNormalizado,
      armazenamentoNormalizado: ctx.armazenamentoNormalizado,
      corNormalizada: ctx.corNormalizada,
      chaveCanonica: ctx.chave,
      nomeBusca: buildNomeBusca(ctx.nomeNormalizado, ctx.armazenamentoNormalizado, ctx.corNormalizada),
    };

    // Upsert atômico: se dois webhooks criarem o mesmo produto ao mesmo tempo, só um insere.
    const tentar = () =>
      ProdutoModel.findOneAndUpdate(
        { chaveCanonica: ctx.chave },
        {
          $setOnInsert: dadosIniciais,
          ...(ctx.aliasBruto ? { $addToSet: { aliases: ctx.aliasBruto } } : {}),
        },
        { upsert: true, new: true, includeResultMetadata: true },
      );

    let resultado;
    try {
      resultado = await tentar();
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      resultado = await tentar(); // perdeu a corrida pelo índice único; agora o documento existe
    }

    const criado = resultado.lastErrorObject?.updatedExisting === false;
    return { produto: resultado.value as IProduto, metodo: criado ? 'novo' : 'exata', criado, score: criado ? 0 : 1 };
  }

  private async resolverCategoria(nome: string | null | undefined): Promise<mongoose.Types.ObjectId> {
    const categoryName = nome?.trim() || 'Outros';
    const category = await CategoryModel.findOneAndUpdate(
      { name: categoryName },
      { $setOnInsert: { name: categoryName } },
      { upsert: true, new: true },
    );
    return category._id as mongoose.Types.ObjectId;
  }

  private async registrarAlias(produtoId: mongoose.Types.ObjectId, alias: string): Promise<void> {
    if (!alias) return;
    await ProdutoModel.updateOne({ _id: produtoId }, { $addToSet: { aliases: alias } });
  }

  /** Guarda a variação resolvida para que, da próxima vez, ela seja um match exato (sem fuzzy/IA). */
  private async aprenderVariacao(produtoId: mongoose.Types.ObjectId, chave: string, alias: string): Promise<void> {
    await ProdutoModel.updateOne(
      { _id: produtoId },
      { $addToSet: { chavesAlternativas: chave, ...(alias ? { aliases: alias } : {}) } },
    );
  }
}
