/**
 * Funções puras de normalização. Toda a "limpeza de ruído" do fornecedor acontece aqui,
 * ANTES de comparar com o catálogo. Quanto mais determinística for essa etapa, menos a IA/embeddings
 * precisam ser acionados.
 */

const FILLER_TOKENS = new Set(['apple', 'de', 'da', 'do', 'com', 'o', 'a', 'e']);

/** Palavras que distinguem produtos diferentes e NUNCA podem divergir num fuzzy match (13 Pro != 13 Pro Max). */
const VARIANT_TOKENS = new Set(['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'air']);

const COLOR_SYNONYMS: Record<string, string> = {
  black: 'preto',
  white: 'branco',
  blue: 'azul',
  gold: 'dourado',
  silver: 'prata',
  purple: 'roxo',
  red: 'vermelho',
  green: 'verde',
  pink: 'rosa',
  yellow: 'amarelo',
  graphite: 'grafite',
};

export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d{2})\s*m\b/g, '$1mm') // "45m" -> "45mm"
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/([a-z])(\d)/g, '$1 $2') // "iphone13" -> "iphone 13"
    .replace(/(\d)([a-z])/g, '$1 $2') // "45mm" -> "45 mm"
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string | null | undefined): string[] {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token && !FILLER_TOKENS.has(token));
}

/**
 * Junta modelo + versão sem duplicar tokens. Resolve a inconsistência clássica do extrator:
 *   { modelo: "iPhone 13", versao: "Pro Max" }  e  { modelo: "iPhone 13 Pro Max", versao: null }
 * geram o mesmo nome normalizado: "iphone 13 pro max".
 */
export function buildNomeNormalizado(modelo: string, versao: string | null): string {
  const tokens = tokenize(modelo);
  for (const token of tokenize(versao)) {
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens.join(' ');
}

/** "128 gb" -> "128GB", "1 TB" -> "1TB", "18/512gb" -> "18GB/512GB". */
export function normalizeStorage(value: string | null | undefined): string | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/,/g, '.');

  const combined = text.match(/(\d+)\s*(?:gb)?\s*\/\s*(\d+(?:\.\d+)?)\s*(gb|tb)?/);
  if (combined) {
    return `${combined[1]}GB/${combined[2]}${(combined[3] || 'gb').toUpperCase()}`;
  }

  const single = text.match(/(\d+(?:\.\d+)?)\s*(gb|tb)/);
  if (single) return `${single[1]}${single[2].toUpperCase()}`;

  return null;
}

export function normalizeColor(value: string | null | undefined): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized
    .split(' ')
    .map((token) => COLOR_SYNONYMS[token] ?? token)
    .join(' ');
}

/** "77%" | "77 %" | "bateria 77" -> "77%". */
export function normalizeBattery(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.match(/\d{1,3}/);
  return digits ? `${digits[0]}%` : null;
}

/** "R$ 1.090,50" -> 1090.5 | "R$ 2.700" -> 2700 | inválido -> null. */
export function parsePrecoBRL(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^\d,.]/g, '');
  if (!cleaned) return null;

  let normalized: string;
  if (cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{2}$/.test(cleaned) && cleaned.split('.').length === 2) {
    normalized = cleaned; // "1490.50"
  } else {
    normalized = cleaned.replace(/\./g, ''); // "1.490" -> milhar
  }

  const price = Number.parseFloat(normalized);
  return Number.isFinite(price) ? price : null;
}

export function buildChaveCanonica(nome: string, armazenamento: string | null, cor: string | null): string {
  return [nome, (armazenamento ?? '').toLowerCase(), cor ?? ''].join('|');
}

export function buildNomeBusca(nome: string, armazenamento: string | null, cor: string | null): string {
  return [nome, armazenamento?.toLowerCase(), cor].filter(Boolean).join(' ');
}

/** Tokens que não podem divergir entre dois nomes para serem considerados o mesmo produto. */
export function hardTokens(nome: string): string {
  return nome
    .split(' ')
    .filter((token) => /\d/.test(token) || VARIANT_TOKENS.has(token))
    .sort()
    .join(' ');
}

/** Similaridade de Levenshtein normalizada (0..1). */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}
