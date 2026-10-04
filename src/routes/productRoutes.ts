import { Router, Request, Response } from 'express';
import { ProductModel } from '../models/ProductModel';
import { CategoryModel } from '../models/CategoryModel';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryParams = req.query;
    const filter: any = {};

    // Campos disponíveis para filtro dinâmico
    const allowedFilters = [
      'categoryId',
      'modelo',
      'versao',
      'armazenamento',
      'cor',
      'saude_bateria',
      'preco',
      'condicao',
      'observacoes',
      'remoteJid',
      'active',
    ];

    // Se houver busca por nome de categoria, buscamos o ID primeiro
    if (queryParams.categoria) {
      const categories = await CategoryModel.find({ 
        name: { $regex: new RegExp(queryParams.categoria as string, 'i') } 
      });
      const categoryIds = categories.map(c => c._id);
      if (categoryIds.length > 0) {
        filter.categoryId = { $in: categoryIds };
      } else {
        // Se a categoria pesquisada não existe, não retorna nenhum produto
        res.status(200).json({ success: true, count: 0, data: [] });
        return;
      }
    }

    for (const key of allowedFilters) {
      if (queryParams[key] !== undefined) {
        if (key === 'active') {
          filter[key] = queryParams[key] === 'true';
        } else if (key === 'categoryId') {
          filter[key] = queryParams[key];
        } else {
          // Busca "case-insensitive" e parcial (contém a string)
          filter[key] = { $regex: new RegExp(queryParams[key] as string, 'i') };
        }
      }
    }

    const products = await ProductModel.find(filter)
      .populate('categoryId')
      .sort({ timestamp: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao buscar produtos' });
  }
});

export default router;
