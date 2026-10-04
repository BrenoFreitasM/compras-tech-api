import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  categoryId: mongoose.Types.ObjectId;
  modelo: string;
  versao: string | null;
  armazenamento: string | null;
  cor: string | null;
  preco: string | null;
  condicao: string | null; // "Novo" ou "Seminovo"
  observacoes: string | null;
  remoteJid: string; // Para saber de qual número veio o produto
  groupName: string | null; // Nome do grupo (se houver)
  groupJid: string | null; // JID do grupo
  messageId: string; // Referência da mensagem
  timestamp: Date;
  active: boolean; // Indica se o produto está ativo (é do dia de hoje)
}

const ProductSchema = new Schema<IProduct>({
  categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  modelo: { type: String, required: true },
  versao: { type: String, default: null },
  armazenamento: { type: String, default: null },
  cor: { type: String, default: null },
  preco: { type: String, default: null },
  condicao: { type: String, default: null },
  observacoes: { type: String, default: null },
  remoteJid: { type: String, required: true },
  groupName: { type: String, default: null },
  groupJid: { type: String, default: null },
  messageId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
