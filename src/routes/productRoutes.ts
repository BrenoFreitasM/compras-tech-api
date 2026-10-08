import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { ProdutoModel } from '../models/ProdutoModel';
import { ProdutoDisponivelModel } from '../models/ProdutoDisponivelModel';
import { FornecedorModel } from '../models/FornecedorModel';
import { CategoryModel } from '../models/CategoryModel';

const router = Router();

const asRegex = (value: unknown) => new RegExp(String(value), 'i');
const hasValue = (value: unknown) => value !== undefined && value !== '';

/**
 * Traduz os filtros de atributos do PRODUTO (catálogo) para um filtro de Produto.
 * Retorna null quando um filtro de categoria não casa com nada (resultado vazio garantido).
 */
async function buildProdutoFilter(query: Request['query']): Promise<Record<string, any> | null> {
  const filter: Record<string, any> = {};

  if (hasValue(query.categoryId)) {
    filter.categoriaId = query.categoryId;
  }

  if (hasValue(query.categoria)) {
    const categories = await CategoryModel.find({ name: { $regex: asRegex(query.categoria) } });
    if (categories.length === 0) return null;
    filter.categoriaId = { $in: categories.map((c) => c._id) };
  }

  if (hasValue(query.modelo)) {
    const rx = asRegex(query.modelo);
    filter.$or = [{ modelo: rx }, { nomeBusca: rx }, { aliases: rx }];
  }
  if (hasValue(query.versao)) filter.versao = asRegex(query.versao);
  if (hasValue(query.armazenamento)) filter.armazenamento = asRegex(query.armazenamento);
  if (hasValue(query.cor)) filter.cor = asRegex(query.cor);

  return filter;
}

router.get('/models', async (req: Request, res: Response): Promise<void> => {
  try {
    const produtoFilter = await buildProdutoFilter({ categoria: req.query.categoria, categoryId: req.query.categoryId });
    if (!produtoFilter) {
      res.status(200).json({ success: true, count: 0, data: [] });
      return;
    }

    // Apenas modelos com pelo menos uma oferta disponível
    const produtoIds = await ProdutoDisponivelModel.distinct('produtoId', { status: 'disponivel' });
    const models = await ProdutoModel.distinct('modelo', { ...produtoFilter, _id: { $in: produtoIds } });

    const cleanModels = models.filter((m) => m).sort();
    res.status(200).json({ success: true, count: cleanModels.length, data: cleanModels });
  } catch (error) {
    console.error('Erro ao buscar modelos:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao buscar modelos' });
  }
});

/**
 * Lista ofertas (produtos_disponiveis) já "achatadas" com os dados do produto e do fornecedor,
 * mantendo o contrato anterior consumido pelo front (modelo, versao, preco, remoteJid, active...).
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const q = req.query;
    const filter: Record<string, any> = {};

    // 1. Filtros que pertencem ao catálogo -> resolve os produtos primeiro
    const produtoFilter = await buildProdutoFilter(q);
    if (!produtoFilter) {
      res.status(200).json({ success: true, count: 0, data: [] });
      return;
    }
    if (Object.keys(produtoFilter).length > 0) {
      const produtoIds = await ProdutoModel.distinct('_id', produtoFilter);
      filter.produtoId = { $in: produtoIds };
    }

    // 2. Filtros que pertencem à oferta
    if (hasValue(q.active)) filter.status = q.active === 'true' ? 'disponivel' : 'indisponivel';
    if (hasValue(q.condicao)) filter.condicao = asRegex(q.condicao);
    if (hasValue(q.observacoes)) filter.observacoes = asRegex(q.observacoes);
    if (hasValue(q.saude_bateria)) filter.saudeBateria = asRegex(q.saude_bateria);
    if (hasValue(q.precoMin) || hasValue(q.precoMax)) {
      filter.preco = {
        ...(hasValue(q.precoMin) ? { $gte: Number(q.precoMin) } : {}),
        ...(hasValue(q.precoMax) ? { $lte: Number(q.precoMax) } : {}),
      };
    }
    if (hasValue(q.fornecedorId) && mongoose.isValidObjectId(q.fornecedorId)) {
      filter.fornecedorId = q.fornecedorId;
    }
    if (hasValue(q.remoteJid)) {
      const fornecedores = await FornecedorModel.distinct('_id', { remoteJid: asRegex(q.remoteJid) });
      filter.fornecedorId = { $in: fornecedores };
    }

    const page = parseInt(q.page as string, 10) || 1;
    const limit = parseInt(q.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const totalCount = await ProdutoDisponivelModel.countDocuments(filter);

    const ofertas = await ProdutoDisponivelModel.find(filter)
      .populate({ path: 'produtoId', populate: { path: 'categoriaId' } })
      .populate('fornecedorId')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const data = ofertas.map((oferta: any) => {
      const produto = oferta.produtoId;
      const fornecedor = oferta.fornecedorId;
      return {
        _id: oferta._id,
        produtoId: produto?._id,
        fornecedorId: fornecedor?._id,
        categoryId: produto?.categoriaId ? { _id: produto.categoriaId._id, name: produto.categoriaId.name } : null,
        modelo: produto?.modelo,
        versao: produto?.versao ?? null,
        armazenamento: produto?.armazenamento ?? null,
        cor: produto?.cor ?? null,
        preco: oferta.preco != null
          ? `R$ ${oferta.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : null,
        precoNumero: oferta.preco,
        saude_bateria: oferta.saudeBateria,
        condicao: oferta.condicao,
        observacoes: oferta.observacoes,
        remoteJid: fornecedor?.remoteJid,
        fornecedor: fornecedor ? { _id: fornecedor._id, nome: fornecedor.nome, telefone: fornecedor.telefone } : null,
        groupName: oferta.groupName,
        groupJid: oferta.groupJid,
        messageId: oferta.messageId,
        timestamp: oferta.timestamp,
        active: oferta.status === 'disponivel',
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      data,
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao buscar produtos' });
  }
});

export default router;
