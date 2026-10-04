import { Router, Request, Response } from 'express';
import { ProductModel } from '../models/ProductModel';
import { CategoryModel } from '../models/CategoryModel';
import { extractProductsFromText } from '../services/productExtractor';

const router = Router();

router.post('/evolution', async (req: Request, res: Response) => {
  // 1. Responde 200 OK imediatamente para a Evolution API
  // Isso evita que a requisição fique "travada" aguardando a OpenAI e impede retentativas desnecessárias.
  res.status(200).json({ success: true });

  // 2. Processa os dados assincronamente em background
  try {
    const payload = req.body;
    console.log(`[Webhook] Requisição recebida em /webhook/evolution`);

    if (payload.event === 'messages.upsert') {
      const messageData = payload.data.message ? payload.data : payload.data.messages?.[0];
      if (!messageData) {
        console.log("Recebi um evento vazio da Evolution.");
        return; // Não enviamos res.status aqui pois já enviamos no topo
      }

      // Se a mensagem vier de um grupo, o remetente real fica em 'participant'.
      // Caso seja mensagem direta (privada), fica em 'remoteJid'.
      const remoteJid = messageData.key?.participant || messageData.participant || messageData.key?.remoteJid;

      // Identifica dados do grupo se vier de um
      const isGroup = messageData.key?.remoteJid?.endsWith('@g.us');
      const groupJid = isGroup ? messageData.key.remoteJid : null;
      const groupName = isGroup ? (messageData.groupName || payload.data.groupName || messageData.pushName || "Grupo Desconhecido") : null;

      const text = 
        messageData.message?.conversation || 
        messageData.message?.extendedTextMessage?.text || 
        messageData.message?.imageMessage?.caption || 
        '';

      console.log(`[MENSAGEM RECEBIDA] Mensagem de ${remoteJid}${isGroup ? ` (Grupo: ${groupName})` : ''}`);

      try {
        const pareceCatalogo = /(R\$|iphone|macbook|apple watch|ipad|oferta|seminovo|produtos)/i.test(text);

        if (text && pareceCatalogo) {
          console.log(`\n🤖 [IA ACIONADA] O texto de ${remoteJid} parece um catálogo. Enviando para análise (consumirá tokens OpenAI)...`);
          
          // Isso aqui pode demorar vários segundos, mas como já demos "res.status(200)", a API não está travada!
          const produtos = await extractProductsFromText(text);
          
          if (produtos.length > 0) {
            console.log(`✅ Extração concluída! Foram encontrados ${produtos.length} produtos.`);
            
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);

            const desativados = await ProductModel.updateMany(
              {
                remoteJid: remoteJid,
                timestamp: { $lt: startOfToday },
                active: true
              },
              {
                $set: { active: false }
              }
            );
            console.log(`🧹 ${desativados.modifiedCount} produtos antigos de ${remoteJid} foram desativados.`);

            for (const prod of produtos) {
              const categoryName = prod.categoria || 'Outros';
              
              let category = await CategoryModel.findOne({ name: categoryName });
              if (!category) {
                category = await CategoryModel.create({ name: categoryName });
                console.log(`🆕 Nova categoria criada: ${categoryName}`);
              }

              const { categoria, ...prodData } = prod;

              await ProductModel.create({
                ...prodData,
                categoryId: category._id,
                remoteJid: remoteJid,
                groupName: groupName,
                groupJid: groupJid,
                messageId: messageData.key?.id || 'SEM_ID',
                timestamp: new Date((messageData.messageTimestamp || Date.now() / 1000) * 1000),
                active: true
              });
            }
            console.log(`✅ Produtos de ${remoteJid} salvos no banco com sucesso!`);
          } else {
            console.log(`Nenhum produto encontrado no texto de ${remoteJid}.`);
          }
        } else if (text) {
          console.log(`⏭️  [IGNORADA] O texto não parece um catálogo. Mensagem ignorada.`);
        }
      } catch (dbError) {
        console.error(`❌ Erro ao salvar mensagem ou produtos no MongoDB:`, dbError);
      }
    }
  } catch (error) {
    console.error('Erro ao processar webhook em background:', error);
  }
});

export default router;
