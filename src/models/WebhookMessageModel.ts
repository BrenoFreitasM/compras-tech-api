import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookMessage extends Document {
  event: string;           // Ex: 'messages.upsert'
  remoteJid: string;       // Quem enviou
  groupJid: string | null; // Se veio de grupo
  groupName: string | null;
  messageId: string;       // ID da mensagem no WhatsApp
  text: string;            // O texto extraído da mensagem
  rawPayload: any;         // O JSON completo recebido da Evolution API
  isCatalog: boolean;      // True se a nossa RegEx achou que era um catálogo
  receivedAt: Date;        // Data de recebimento
}

const WebhookMessageSchema = new Schema<IWebhookMessage>({
  event: { type: String, required: true },
  remoteJid: { type: String, required: true },
  groupJid: { type: String, default: null },
  groupName: { type: String, default: null },
  messageId: { type: String, required: true },
  text: { type: String, default: '' },
  rawPayload: { type: Schema.Types.Mixed, required: true },
  isCatalog: { type: Boolean, default: false },
  receivedAt: { type: Date, default: Date.now },
}, {
  timestamps: true,
  collection: 'webhook_messages',
});

// Índices para facilitar buscas futuras
WebhookMessageSchema.index({ remoteJid: 1, receivedAt: -1 });
WebhookMessageSchema.index({ isCatalog: 1, receivedAt: -1 });

export const WebhookMessageModel = mongoose.model<IWebhookMessage>('WebhookMessage', WebhookMessageSchema);
