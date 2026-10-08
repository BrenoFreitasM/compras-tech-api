import { normalizeColor } from './services/productNormalizer';

const testCases = [
  'laranja',
  'orange', // não temos laranja/orange mapeado nativamente na apple pra celulares principais, mas vamos testar
  'deep blue',
  'Space Gray',
  'Cinza Espacial',
  'Meia-Noite',
  'Midnight',
  'Azul Serra',
  'Sierra Blue',
  'Titanium Black',
  'Titânio Natural'
];

testCases.forEach(c => {
  console.log(`${c.padEnd(20)} => ${normalizeColor(c)}`);
});
