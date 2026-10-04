import { Router, Request, Response } from 'express';
import { CategoryModel } from '../models/CategoryModel';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const categories = await CategoryModel.find().sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    console.error('Erro ao buscar categorias:', error);
    res.status(500).json({ error: 'Erro interno ao buscar categorias' });
  }
});

export default router;
