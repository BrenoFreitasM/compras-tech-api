import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";
import * as dotenv from "dotenv";

dotenv.config();

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

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

const schema = z.object({
  produtos: z
    .array(produtoSchema)
    .describe("Lista de produtos e suas especificações extraídas do texto"),
});

const modelWithStructure = llm.withStructuredOutput(schema, {
  name: "extrator_de_produtos",
});

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system", 
    `Você é um assistente especialista em extração de dados de e-commerce e inventário. 
Sua tarefa é encontrar e catalogar todos os produtos listados no texto fornecido.
O texto pode conter iPhones, MacBooks, Apple Watches, Câmeras e Acessórios.
Extraia as informações detalhadas sobre a categoria, modelo, versão, capacidade de armazenamento, cor, saúde da bateria, preço e outras observações de cada item.
Siga estritamente as propriedades disponíveis no esquema.`
  ],
  ["human", "Texto de entrada:\n{texto}"]
]);

const chain = prompt.pipe(modelWithStructure);

export async function extractProductsFromText(text: string) {
  if (!text || text.trim().length === 0) {
    return [];
  }
  try {
    const result = await chain.invoke({ texto: text });
    return result.produtos || [];
  } catch (error) {
    console.error("Erro ao extrair produtos do texto:", error);
    return [];
  }
}
