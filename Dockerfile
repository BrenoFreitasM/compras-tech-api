FROM node:18-alpine

WORKDIR /app

# Copia os arquivos de dependência primeiro (para usar o cache do Docker)
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código TypeScript
COPY . .

# Compila o projeto (gera a pasta dist)
RUN npm run build

# Expõe a porta que o Express costuma usar (ajuste se a sua for diferente, ex: 3000)
EXPOSE 3002

# Comando para iniciar o servidor
CMD ["npm", "start"]
