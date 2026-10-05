# ==========================================
# Estágio 1: Build (Construção da Aplicação)
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copia os arquivos de configuração de dependências
COPY package*.json ./
COPY tsconfig.json ./

# Instala TODAS as dependências (incluindo as de desenvolvimento como TypeScript)
RUN npm install

# Copia o código fonte
COPY src ./src

# Compila o TypeScript para JavaScript (gera a pasta dist/)
RUN npm run build

# ==========================================
# Estágio 2: Produção (Imagem Final Leve)
# ==========================================
FROM node:20-alpine AS runner

# Define variável de ambiente como produção para otimizações do Node/Express
ENV NODE_ENV=production

WORKDIR /app

# Copia apenas o package.json
COPY package*.json ./

# Instala APENAS as dependências necessárias para rodar o app (ignora devDependencies)
RUN npm ci --only=production

# Copia apenas os arquivos já compilados do estágio anterior
COPY --from=builder /app/dist ./dist

# Expõe a porta
EXPOSE 3002

# Inicia o servidor Node diretamente a partir da pasta dist
CMD ["node", "dist/server.js"]
