import { extractProductsFromText } from './services/productExtractor';

async function run() {
  const text = `
    iPhone 13 128GB Midnight Lacrado - R$ 4000
    iPhone 14 Pro Max 256GB Bateria 90% - R$ 5000
  `;
  const produtos = await extractProductsFromText(text);
  console.log(produtos);
}
run();
