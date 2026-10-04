import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../models/UserModel';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });
    if (!user) {
      res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Credenciais inválidas' });
      return;
    }

    // Gerar novo ID de sessão e salvar no banco (invalida as antigas)
    const sessionId = crypto.randomUUID();
    user.activeSessionId = sessionId;
    await user.save();

    const token = jwt.sign(
      { userId: user._id, email: user.email, sessionId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao realizar login' });
  }
});

router.post('/logout', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userPayload = (req as any).user;
    await UserModel.findByIdAndUpdate(userPayload.userId, { activeSessionId: null });
    
    res.json({ success: true, message: 'Logout realizado com sucesso. Sessão encerrada.' });
  } catch (error) {
    console.error('Erro no logout:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao realizar logout' });
  }
});

router.post('/register', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'Nome, email e senha são obrigatórios' });
      return;
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      res.status(400).json({ success: false, error: 'Email já está em uso' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({
      email,
      passwordHash,
      name
    });

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Erro ao registrar usuário:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao criar usuário' });
  }
});


router.get('/me', authMiddleware, async (req: Request, res: Response): Promise<void> => {
  try {
    const userPayload = (req as any).user;
    const user = await UserModel.findById(userPayload.userId).select('-passwordHash');
    if (!user) {
      res.status(401).json({ success: false, error: 'Usuário não encontrado' });
      return;
    }
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Erro interno' });
  }
});

export default router;
