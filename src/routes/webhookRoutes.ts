import { Router, Request, Response } from 'express';
import { MessageModel } from '../models/MessageModel';

const router = Router();

router.post('/evolution', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    console.log(`\n[WEBHOOK RECEBIDO] Instância: ${payload.instance} | Evento: ${payload.event}`);

    // A Evolution envia o evento indicando do que se trata.
    // Queremos apenas mensagens sendo criadas/recebidas
    if (payload.event === 'messages.upsert') {

      const messageData = payload.data.message ? payload.data : payload.data.messages?.[0];
      if (!messageData) {
        console.log("Recebi um evento vazio da Evolution.");
        return res.status(200).json({ success: true });
      }

      const remoteJid = messageData.key.remoteJid;

      console.log("ALGUÉM MANDOU MENSAGEM! O Número exato é:", remoteJid);

      // Extrai o texto da mensagem (varia se é texto puro, imagem com legenda, etc)
      const text = 
        messageData.message?.conversation || 
        messageData.message?.extendedTextMessage?.text || 
        messageData.message?.imageMessage?.caption || 
        '';

      console.log(`[MENSAGEM RECEBIDA] Mensagem de ${remoteJid}: ${text}`);

      try {
        // Salva no MongoDB
        await MessageModel.create({
          instanceId: payload.instance,
          messageId: messageData.key?.id || 'SEM_ID',
          remoteJid: remoteJid,
          pushName: messageData.pushName || '',
          text: text,
          timestamp: new Date((messageData.messageTimestamp || Date.now() / 1000) * 1000), // Converte timestamp UNIX
          // rawPayload: payload
        });
        console.log(`✅ Mensagem de ${remoteJid} salva no banco com sucesso!`);
      } catch (dbError) {
        console.error(`❌ Erro ao salvar mensagem no MongoDB:`, dbError);
      }
    }

    // SEMPRE retorne 200 para a Evolution rapidamente, ou ela tentará reenviar o webhook
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Mesmo com erro na nossa lógica, retornar 200 evita repetição infinita
    // Mas você pode retornar 500 dependendo da sua estratégia de retry na Evolution
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
