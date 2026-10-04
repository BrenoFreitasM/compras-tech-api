import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  categoria: string;
  modelo: string;
  versao: string | null;
  armazenamento: string | null;
  cor: string | null;
  saude_bateria: string | null;
  preco: string | null;
  observacoes: string | null;
  remoteJid: string; // Para saber de qual número veio o produto
  messageId: string; // Referência da mensagem
  timestamp: Date;
  active: boolean; // Indica se o produto está ativo (é do dia de hoje)
}

const ProductSchema = new Schema<IProduct>({
  categoria: { type: String, required: true },
  modelo: { type: String, required: true },
  versao: { type: String, default: null },
  armazenamento: { type: String, default: null },
  cor: { type: String, default: null },
  saude_bateria: { type: String, default: null },
  preco: { type: String, default: null },
  observacoes: { type: String, default: null },
  remoteJid: { type: String, required: true },
  messageId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

export const ProductModel = mongoose.model<IProduct>('Product', ProductSchema);
