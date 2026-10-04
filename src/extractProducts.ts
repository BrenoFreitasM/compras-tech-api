import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import * as dotenv from "dotenv";
import * as fs from "fs";

// Carrega as variáveis de ambiente
dotenv.config();

// Inicializa o modelo da OpenAI
const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini", // Use um modelo bom para estruturação
  temperature: 0,
});

// Define o esquema do produto que queremos extrair usando Zod
const produtoSchema = z.object({
  categoria: z.string().describe("Categoria do produto (ex: Smartphone, Smartwatch, Notebook, Acessório, Câmera)"),
  modelo: z.string().describe("A linha ou modelo principal do aparelho (ex: iPhone 13, MacBook Pro M3, Watch Series 7, Magic Keyboard)"),
  versao: z.string().nullable().describe("Versão ou características extras (ex: Pro Max, Ultra, 45mm)"),
  armazenamento: z.string().nullable().describe("Capacidade de armazenamento (ex: 64GB, 128GB, 512GB)"),
  cor: z.string().nullable().describe("Cor do aparelho (ex: Preto, Dourado, Titânio, Branco, etc)"),
  saude_bateria: z.string().nullable().describe("Porcentagem de saúde da bateria (ex: 77%, 100%)"),
  preco: z.string().nullable().describe("Preço com desconto no Pix (ex: R$ 1.490)"),
  observacoes: z.string().nullable().describe("Outras notas como estado de uso ou garantia (ex: Zero, Garantia Apple, 4 Meses de uso)"),
});

// Esquema final que espera uma lista (array) de produtos
const schema = z.object({
  produtos: z
    .array(produtoSchema)
    .describe("Lista de produtos e suas especificações extraídas do texto"),
});

// Força a IA a responder exatamente no formato do schema
const modelWithStructure = llm.withStructuredOutput(schema, {
  name: "extrator_de_produtos",
});

// Cria o prompt instruindo o que a IA deve fazer
const prompt = ChatPromptTemplate.fromMessages([
  [
    "system", 
    `Você é um assistente especialista em extração de dados de e-commerce e inventário. 
Sua tarefa é encontrar e catalogar todos os produtos listados no texto fornecido.
O texto pode conter iPhones, MacBooks, Apple Watches, Câmeras e Acessórios.
Extraia as informações detalhadas sobre a categoria, modelo, versão, capacidade de armazenamento, cor, saúde da bateria, preço e outras observações de cada item.
Se o texto indicar que se trata de produtos "Seminovos" (por exemplo, no cabeçalho ou título) ou se o item apresentar indícios de uso prévio, inclua a tag "Seminovo" no campo de observações, junto de outras notas que possam existir.
Siga estritamente as propriedades disponíveis no esquema.`
  ],
  ["human", "Texto de entrada:\n{texto}"]
]);

// Monta a Chain
const chain = prompt.pipe(modelWithStructure);

async function main() {
  const textoDeExemplo = `Ofertas - Seminovos 🔥
22/09

⭐ Padrão Veggi tech. 
🔐 Com garantia Limitada
👇Preços com desconto no Pix 

————————
⌨️Teclado Magic Keyboard touch iD
(Zero, com Garantia Apple)
R$ 1.090🔥
————————
📸Camera DJI Osmo Pocket 3
(Zero, Garantia DJI)
R$ 2.570 
———————
💻MacBook Pro M3 (Pro) 14” 18/512gb 
R$ 7.890 🔥💎
————————
⌚Watch Series 7 45m Preto 87%
Caixa + Pulseiras originais
R$ 1.150🔥

⌚Watch Series 11 46mm Preto 100%
(4 Meses de uso +Garantia Apple)
R$ 1.990💎🔥

⌚Watch Ultra 1 49m Titânio 95%
Pulseiras originais 
R$ 2.590🔥
————————
📱 iPhone 12 Pro 128gb Dourado 77% 
R$ 1.490🔥

📱 iPhone 13 128gb Preto 80%
R$ 1.590🔥

📱 iPhone 14 128gb Branco 100%
R$ 1.790🔥

📱 iPhone 13 Pro Max 128gb Grafite 79%
R$ 2.090 🔥

📱 iPhone 13 Pro Max 128gb Preto 82%
R$ 2.190 🔥

📱iPhone 14 Pro 128gb Roxo 80%
R$ 2.490🔥 

📱iPhone 16 128gb Branco 93%
R$ 3.990🔥

📱iPhone 16 Pro 128gb Branco 92%
R$ 4.190🔥 

📱iPhone 17 256gb Preto 100% 
(Garantia Apple)
R$ 4.590🔥

📱iPhone 17 Pro 256gb Azul 100% 
(Garantia Apple)
R$ 6.090🔥

📱iPhone 17 Pro 256gb Prata 100% 
(Garantia Apple)
R$ 6.190🔥

📱iPhone 17 Pro Max 256gb Azul 100% 
(Garantia Apple)
R$ 7.190🔥
——————————————`;
  
  console.log("⏳ Extraindo catálogo de produtos usando IA (LangChain)...\n");
  
  try {
    const result = await chain.invoke({ texto: textoDeExemplo });
    
    // Salva o resultado em um arquivo JSON
    const outputFile = "produtos_extraidos.json";
    fs.writeFileSync(outputFile, JSON.stringify(result.produtos, null, 2), "utf-8");
    
    console.log(`✅ Extração concluída com sucesso!`);
    console.log(`💾 Os produtos foram salvos no arquivo: ${outputFile}`);
  } catch (error) {
    console.error("❌ Erro ao extrair produtos:", error);
    console.log("\n⚠️  Dica: Verifique se você adicionou a OPENAI_API_KEY no seu arquivo .env");
  }
}

main();
