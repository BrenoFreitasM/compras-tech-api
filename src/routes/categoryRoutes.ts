import { Router, Request, Response } from 'express';
import { CategoryModel } from '../models/CategoryModel';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const log = req.log || logger;
  try {
    const categories = await CategoryModel.find().sort({ name: 1 });
    res.json({ categories });
  } catch (error) {
    log.error({ err: error }, 'Erro ao buscar categorias');
    res.status(500).json({ error: 'Erro interno ao buscar categorias' });
  }
});

export default router;
