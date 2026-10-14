import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import * as swaggerDocument from './swagger.json';
import webhookRoutes from './routes/webhookRoutes';
import productRoutes from './routes/productRoutes';
import categoryRoutes from './routes/categoryRoutes';
import authRoutes from './routes/authRoutes';
import { authMiddleware } from './middleware/authMiddleware';
import { logger } from './utils/logger';

dotenv.config();

const app = express();

// HTTP Request Logger com Correlation ID
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    customLogLevel: (res, err) => {
      const status = res.statusCode ?? 200;
      if (status >= 500 || err) return 'error';
      if (status >= 400) return 'warn';
      return 'info';
    },
    autoLogging: {
      ignore: (req) => req.url?.startsWith('/api-docs') ?? false,
    },
  })
);

app.use(express.json({ limit: '50mb' })); // Aumenta o limite pois webhooks com media em base64 podem ser grandes

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Registra as rotas
app.use('/webhook', webhookRoutes);
app.use('/auth', authRoutes); // /auth/login e /auth/register
app.use('/products', productRoutes); // Deixado público para o frontend compras-tech
app.use('/categories', categoryRoutes); // Deixado público

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI as string;

// Conecta ao MongoDB e sobe o servidor
mongoose.connect(MONGO_URI)
  .then(() => {
    logger.info('📦 Conectado ao MongoDB com sucesso!');
    app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info({ port: PORT }, `🚀 Servidor rodando na porta ${PORT}`);
      logger.info(`🔗 URL do Swagger: http://localhost:${PORT}/api-docs`);
      logger.info(`🔗 Endpoint de escuta: http://localhost:${PORT}/webhook/evolution`);
    });
  })
  .catch((error) => {
    logger.error({ err: error }, 'Erro ao conectar ao MongoDB');
    process.exit(1);
  });

