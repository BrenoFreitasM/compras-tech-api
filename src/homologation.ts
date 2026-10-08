import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ProductIngestService } from './services/productIngestService';
import { ProdutoModel } from './models/ProdutoModel';
import { FornecedorModel } from './models/FornecedorModel';
import { ProdutoDisponivelModel } from './models/ProdutoDisponivelModel';
import { CategoryModel } from './models/CategoryModel';

dotenv.config();

async function runTest() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/compras-tech';
  await mongoose.connect(MONGO_URI);
  console.log('📦 Conectado ao MongoDB para Homologação!\n');

  // Limpar banco para o teste (OPCIONAL, mas bom para garantir o cenário isolado)
  // await ProdutoModel.deleteMany({});
  // await FornecedorModel.deleteMany({});
  // await ProdutoDisponivelModel.deleteMany({});
  // await CategoryModel.deleteMany({});

  const ingestService = new ProductIngestService();

  // --- CENA 1: Primeiro webhook recebido (Fornecedor A) ---
  console.log('📥 [CENA 1] Recebendo Webhook 1 - Fornecedor A (5511999999999)');
  const resumo1 = await ingestService.processarLista(
    [
      {
        categoria: 'Smartphone',
        modelo: 'iPhone 13 Pro Max',
        versao: null,
        armazenamento: '128GB',
        cor: 'Azul',
        saude_bateria: '100%',
        preco: 'R$ 4.500',
        condicao: 'Novo',
        observacoes: 'Lacrado',
      }
    ],
    { remoteJid: '5511999999999@s.whatsapp.net', nome: 'Fornecedor A (Atacado)' },
    { messageId: 'MSG-001', timestamp: new Date(), groupJid: null, groupName: null }
  );
  console.log('📊 Resumo 1:', resumo1, '\n');

  // --- CENA 2: Novo webhook do Fornecedor A (Digitação diferente / Fuzzy Match) ---
  console.log('📥 [CENA 2] Recebendo Webhook 2 - Fornecedor A (typo no modelo e bateria diferente)');
  const resumo2 = await ingestService.processarLista(
    [
      {
        categoria: 'Smartphone',
        modelo: 'Iphone 13',
        versao: 'pro max', // veio quebrado em versao
        armazenamento: '128 GB', // com espaço
        cor: 'Blue', // cor em inglês
        saude_bateria: '85%',
        preco: 'R$ 3.800',
        condicao: 'Seminovo',
        observacoes: 'Vitrine',
      }
    ],
    { remoteJid: '5511999999999@s.whatsapp.net', nome: 'Fornecedor A (Atacado)' },
    { messageId: 'MSG-002', timestamp: new Date(), groupJid: null, groupName: null }
  );
  console.log('📊 Resumo 2:', resumo2, '\n');

  // --- CENA 3: Webhook do Fornecedor B ---
  console.log('📥 [CENA 3] Recebendo Webhook 3 - Fornecedor B (5511888888888)');
  const resumo3 = await ingestService.processarLista(
    [
      {
        categoria: 'Notebook',
        modelo: 'MacBook Air M1',
        versao: null,
        armazenamento: '256GB',
        cor: 'Prata',
        saude_bateria: null,
        preco: 'R$ 4.800,00',
        condicao: 'Seminovo',
        observacoes: 'Na caixa',
      },
      {
        categoria: 'Smartphone',
        modelo: 'iPhone 13 Pro Max',
        versao: null,
        armazenamento: '128GB',
        cor: 'Azul', // Mesmo produto do fornecedor A
        saude_bateria: '90%',
        preco: 'R$ 4.000',
        condicao: 'Seminovo',
        observacoes: '',
      }
    ],
    { remoteJid: '5511888888888@s.whatsapp.net', nome: 'Mundo Apple B' },
    { messageId: 'MSG-003', timestamp: new Date(), groupJid: null, groupName: null }
  );
  console.log('📊 Resumo 3:', resumo3, '\n');

  // --- RESULTADO FINAL NO BANCO ---
  console.log('🔎 --- ESTADO FINAL DO CATÁLOGO DE PRODUTOS ---');
  const produtos = await ProdutoModel.find({}).lean();
  for (const p of produtos) {
    console.log(`- 📱 Produto Base: ${p.nomeNormalizado} | Armaz: ${p.armazenamentoNormalizado} | Cor: ${p.corNormalizada}`);
    
    const ofertas = await ProdutoDisponivelModel.find({ produtoId: p._id }).populate('fornecedorId').lean();
    for (const o of ofertas) {
      console.log(`    💰 Disponível em: ${(o.fornecedorId as any).nome} | Por: R$ ${o.preco} | Bat: ${o.saudeBateria}`);
    }
  }

  await mongoose.disconnect();
}

runTest().catch(console.error);
