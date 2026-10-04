import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { UserModel } from './models/UserModel';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI as string;

async function seedUser() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📦 Conectado ao MongoDB para Seed!');

    const email = 'admin@comprastech.com'; // Altere se desejar
    const password = 'Neymar@1'; // Senha padrão
    const name = 'Admin Veiggi';

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      console.log('⚠️ O usuário seed já existe no banco de dados!');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await UserModel.create({
      email,
      passwordHash,
      name
    });

    console.log(`✅ Usuário seed criado com sucesso!`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Senha: ${password}`);
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário seed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedUser();
