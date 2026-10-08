import mongoose, { Document, Schema } from 'mongoose';

/**
 * Fornecedor = quem publica as listas de produtos (identificado pelo JID do WhatsApp).
 * O grupo onde a mensagem foi enviada é contexto da oferta, não identidade do fornecedor,
 * por isso fica em ProdutoDisponivel.
 */
export interface IFornecedor extends Document {
  remoteJid: string; // JID único do remetente (participant em grupos, remoteJid em chats diretos)
  nome: string | null; // pushName enviado pelo WhatsApp
  telefone: string | null; // somente dígitos, derivado do JID
  ativo: boolean;
  ultimaMensagemEm: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FornecedorSchema = new Schema<IFornecedor>({
  remoteJid: { type: String, required: true, unique: true },
  nome: { type: String, default: null },
  telefone: { type: String, default: null },
  ativo: { type: Boolean, default: true },
  ultimaMensagemEm: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'fornecedores',
});

export const FornecedorModel = mongoose.model<IFornecedor>('Fornecedor', FornecedorSchema);
