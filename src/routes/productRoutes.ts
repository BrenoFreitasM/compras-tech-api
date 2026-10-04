import { Router, Request, Response } from 'express';
import { ProductModel } from '../models/ProductModel';

const router = Router();

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const queryParams = req.query;
    const filter: any = {};

    // Campos disponíveis para filtro dinâmico
    const allowedFilters = [
      'categoria',
      'modelo',
      'versao',
      'armazenamento',
      'cor',
      'saude_bateria',
      'preco',
      'observacoes',
      'remoteJid',
      'active',
    ];

    for (const key of allowedFilters) {
      if (queryParams[key] !== undefined) {
        // Se for string, podemos usar regex para busca parcial, mas vamos manter exato para booleanos
        if (key === 'active') {
          filter[key] = queryParams[key] === 'true';
        } else {
          // Busca "case-insensitive" e parcial (contém a string)
          filter[key] = { $regex: new RegExp(queryParams[key] as string, 'i') };
        }
      }
    }

    const products = await ProductModel.find(filter).sort({ timestamp: -1 });

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
