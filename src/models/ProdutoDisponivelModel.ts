import mongoose, { Document, Schema } from 'mongoose';

export type CondicaoProduto = 'Novo' | 'Seminovo';
export type StatusDisponibilidade = 'disponivel' | 'indisponivel';

/**
 * Oferta de um Fornecedor para um Produto do catálogo (dados voláteis vindos do webhook).
 * Identidade da oferta: fornecedor + produto + condição + saúde da bateria
 * (o mesmo fornecedor pode listar dois iPhones iguais com baterias diferentes).
 */
export interface IProdutoDisponivel extends Document {
  produtoId: mongoose.Types.ObjectId;
  fornecedorId: mongoose.Types.ObjectId;

  condicao: CondicaoProduto | null;
  saudeBateria: string | null;
  preco: number | null; // em reais, para ordenar/comparar
  precoTexto: string | null; // como o fornecedor escreveu (ex: "R$ 1.490")
  observacoes: string | null;
  status: StatusDisponibilidade;

  // Origem da última atualização
  groupJid: string | null;
  groupName: string | null;
  messageId: string;
  timestamp: Date; // data da mensagem do WhatsApp

  payloadBruto: unknown; // item exatamente como extraído do webhook (auditoria / reprocessamento)

  primeiraVistaEm: Date;
  ultimaVistaEm: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProdutoDisponivelSchema = new Schema<IProdutoDisponivel>({
  produtoId: { type: Schema.Types.ObjectId, ref: 'Produto', required: true },
  fornecedorId: { type: Schema.Types.ObjectId, ref: 'Fornecedor', required: true },

  condicao: { type: String, enum: ['Novo', 'Seminovo', null], default: null },
  saudeBateria: { type: String, default: null },
  preco: { type: Number, default: null },
  precoTexto: { type: String, default: null },
  observacoes: { type: String, default: null },
  status: { type: String, enum: ['disponivel', 'indisponivel'], default: 'disponivel' },

  groupJid: { type: String, default: null },
  groupName: { type: String, default: null },
  messageId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },

  payloadBruto: { type: Schema.Types.Mixed, default: null },

  primeiraVistaEm: { type: Date, default: Date.now },
  ultimaVistaEm: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'produtos_disponiveis',
});

// Garante um único vínculo por oferta -> o upsert do webhook é idempotente e seguro contra concorrência.
ProdutoDisponivelSchema.index(
  { fornecedorId: 1, produtoId: 1, condicao: 1, saudeBateria: 1 },
  { unique: true },
);
// Comparar preços de um produto entre fornecedores.
ProdutoDisponivelSchema.index({ produtoId: 1, status: 1, preco: 1 });
// Listagem do front e rotina de desativação de ofertas vencidas.
ProdutoDisponivelSchema.index({ status: 1, timestamp: -1 });
ProdutoDisponivelSchema.index({ fornecedorId: 1, status: 1, ultimaVistaEm: 1 });

export const ProdutoDisponivelModel = mongoose.model<IProdutoDisponivel>('ProdutoDisponivel', ProdutoDisponivelSchema);
