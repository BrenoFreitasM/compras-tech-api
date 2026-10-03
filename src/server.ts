import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from './swagger.json';
import webhookRoutes from './routes/webhookRoutes';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' })); // Aumenta o limite pois webhooks com media em base64 podem ser grandes

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Registra as rotas
app.use('/webhook', webhookRoutes);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI as string;

// Conecta ao MongoDB e sobe o servidor
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('📦 Conectado ao MongoDB com sucesso!');
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Servidor de Webhooks rodando na porta ${PORT}`);
      console.log(`📃 Documentação Swagger rodando na porta ${PORT}`);
      console.log(`🔗 URL do Swagger: http://localhost:${PORT}/api-docs`);
      console.log(`Endpoint de escuta: http://localhost:${PORT}/webhook/evolution`);
    });
  })
  .catch((error) => {
    console.error('Erro ao conectar ao MongoDB:', error);
    process.exit(1);
  });
