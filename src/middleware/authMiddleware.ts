import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/UserModel';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

export interface AuthRequest extends Request {
  user?: any;
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Token não fornecido ou formato inválido' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    // Verifica a assinatura e expiração do JWT
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Busca o usuário no banco
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }

    // Single Session Check: valida se o sessionId do JWT bate com o do banco
    if (!user.activeSessionId || user.activeSessionId !== decoded.sessionId) {
      res.status(401).json({ 
        success: false, 
        error: 'Sessão expirada. Um novo login foi realizado em outro dispositivo.' 
      });
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
  }
}
