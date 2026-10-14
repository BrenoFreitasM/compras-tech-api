import { Router, Request, Response } from 'express';
import { extractProductsFromText } from '../services/productExtractor';
import { ProductIngestService } from '../services/productIngestService';
import { WebhookMessageModel } from '../models/WebhookMessageModel';
import { logger } from '../utils/logger';

const router = Router();
const ingestService = new ProductIngestService();

router.post('/evolution', async (req: Request, res: Response) => {
  // 1. Responde 200 OK imediatamente para a Evolution API
  // Isso evita que a requisição fique "travada" aguardando a OpenAI e impede retentativas desnecessárias.
  res.status(200).json({ success: true });

  const rootLog = req.log || logger;

  // 2. Processa os dados assincronamente em background
  try {
    const payload = req.body;
    rootLog.debug({ event: payload?.event }, 'Payload de webhook recebido em /webhook/evolution');

    if (payload?.event === 'messages.upsert') {
      const messageData = payload.data?.message ? payload.data : payload.data?.messages?.[0];
      if (!messageData) {
        rootLog.warn('Recebido evento messages.upsert com payload de mensagem vazio');
        return;
      }

      // Se a mensagem vier de um grupo, o remetente real fica em 'participant'.
      // Caso seja mensagem direta (privada), fica em 'remoteJid'.
      const remoteJid = messageData.key?.participant || messageData.participant || messageData.key?.remoteJid;

      // Identifica dados do grupo se vier de um
      const isGroup = Boolean(messageData.key?.remoteJid?.endsWith('@g.us'));
      const groupJid = isGroup ? messageData.key?.remoteJid : null;
      const groupName = isGroup ? (messageData.groupName || payload.data?.groupName || messageData.pushName || 'Grupo Desconhecido') : null;
      const messageId = messageData.key?.id || 'SEM_ID';

      const text = 
        messageData.message?.conversation || 
        messageData.message?.extendedTextMessage?.text || 
        messageData.message?.imageMessage?.caption || 
        '';

      // Cria logger contextualizado com remetente, grupo e messageId
      const log = rootLog.child({
        remoteJid,
        isGroup,
        groupName: groupName || undefined,
        messageId,
      });

      log.info({ textLength: text.length }, 'Mensagem de WhatsApp recebida');

      try {
        const pareceCatalogo = /(R\$|iphone|macbook|apple watch|ipad|airpods|airtag|apple pencil|imac|oferta|seminovo|produtos|lista atualizada|dropshipping|atacado|tabela|lacrado|vitrine|swap)/i.test(text);

        // SALVA O PAYLOAD CRU NO DATA LAKE (Independente se é catálogo ou não)
        await WebhookMessageModel.create({
          event: payload.event,
          remoteJid,
          groupJid,
          groupName,
          messageId,
          text,
          rawPayload: payload,
          isCatalog: pareceCatalogo,
        });

        if (text && pareceCatalogo) {
          log.info('Texto identificado como catálogo. Enviando para análise da OpenAI...');
          
          const startTime = Date.now();
          const produtos = await extractProductsFromText(text);
          const durationMs = Date.now() - startTime;
          
          if (produtos.length > 0) {
            log.info({ count: produtos.length, durationMs }, 'Extração da IA concluída com sucesso');

            const resumo = await ingestService.processarLista(
              produtos,
              { remoteJid, nome: messageData.pushName || null },
              {
                messageId,
                timestamp: new Date((messageData.messageTimestamp || Date.now() / 1000) * 1000),
                groupJid,
                groupName,
              },
            );

            log.info(
              {
                resumo,
                durationMs,
              },
              `Lista de produtos processada: ${resumo.produtosNovos} novos, ${resumo.ofertasCriadas} ofertas criadas, ${resumo.ofertasAtualizadas} atualizadas`,
            );
          } else {
            log.warn({ durationMs }, 'Nenhum produto identificado pela IA no texto do catálogo');
          }

        } else if (text) {
          log.debug('Texto não parece um catálogo. Mensagem ignorada para análise de IA.');
        }
      } catch (dbError) {
        log.error({ err: dbError }, 'Erro ao salvar mensagem ou produtos no MongoDB');
      }
    }
  } catch (error) {
    rootLog.error({ err: error }, 'Erro ao processar webhook em background');
  }
});

export default router;

