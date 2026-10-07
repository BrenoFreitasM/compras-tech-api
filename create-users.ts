import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from './src/models/UserModel';

const MONGO_URI = "mongodb://rootadmin:Mongo_S3cure_Pass_2026!@179.236.243.47:27017/compras_tech?authSource=admin";

const usersToCreate = [
  { email: 'kauacamposx@gmail.com', password: 'Alterar123', name: 'Kauã Campos' },
  { email: 'isacgt3@gmail.com', password: 'Neymar@1', name: 'Isac' },
  { email: 'matheusaaraujo1998@icloud.com', password: 'Alterar123', name: 'Matheus Araujo' }
];

async function createUsers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('📦 Conectado ao MongoDB Remoto na VPS!');

    for (const user of usersToCreate) {
      const existingUser = await UserModel.findOne({ email: user.email });
      if (existingUser) {
        console.log(`⚠️ Usuário ${user.email} já existe.`);
        continue;
      }

      const passwordHash = await bcrypt.hash(user.password, 10);
      await UserModel.create({
        email: user.email,
        passwordHash,
        name: user.name
      });
      console.log(`✅ Usuário ${user.email} criado com sucesso!`);
    }
  } catch (error) {
    console.error('❌ Erro ao conectar ou criar usuários:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createUsers();
