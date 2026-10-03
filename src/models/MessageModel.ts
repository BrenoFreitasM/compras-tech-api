import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
  instanceId: string;
  messageId: string;
  remoteJid: string; // Número de quem enviou (ex: 5511999999999@s.whatsapp.net)
  pushName: string; // Nome do perfil do WhatsApp
  text: string;
  timestamp: Date;
  rawPayload: any; // Salva o payload completo original caso precise depois
}

const MessageSchema: Schema = new Schema({
  instanceId: { type: String, required: true },
  messageId: { type: String, required: true },
  remoteJid: { type: String, required: true },
  pushName: { type: String, default: '' },
  text: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
  rawPayload: { type: Schema.Types.Mixed }
});

export const MessageModel = mongoose.model<IMessage>('Message', MessageSchema);
