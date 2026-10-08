import mongoose, { Document, Schema } from 'mongoose';

/**
 * Catálogo base: representa UM produto/variante (modelo + armazenamento + cor), independente de
 * quem vende, por quanto e em qual condição. Nada volátil (preço, bateria, condição, status) mora aqui.
 *
 * Os campos "*Normalizad*" e `chaveCanonica` existem para o matching determinístico/fuzzy
 * (e para dar contexto limpo à IA quando ela precisar desempatar).
 */
export interface IProduto extends Document {
  categoriaId: mongoose.Types.ObjectId;

  // Atributos universais (valores de exibição, "primeiro visto")
  modelo: string;
  versao: string | null;
  armazenamento: string | null; // canônico, ex: "128GB"
  cor: string | null;

  // Identidade para matching
  nomeNormalizado: string; // tokens de modelo+versão, sem acento/ruído, ex: "iphone 13 pro max"
  armazenamentoNormalizado: string | null;
  corNormalizada: string | null;
  chaveCanonica: string; // única; chave determinística
  chavesAlternativas: string[]; // chaves de variações já resolvidas (fuzzy/IA) -> próximo match é exato
  aliases: string[]; // nomes como os fornecedores escrevem (contexto para IA / busca textual)
  nomeBusca: string; // texto único para busca textual / embedding futuro

  createdAt: Date;
  updatedAt: Date;
}

const ProdutoSchema = new Schema<IProduto>({
  categoriaId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },

  modelo: { type: String, required: true },
  versao: { type: String, default: null },
  armazenamento: { type: String, default: null },
  cor: { type: String, default: null },

  nomeNormalizado: { type: String, required: true },
  armazenamentoNormalizado: { type: String, default: null },
  corNormalizada: { type: String, default: null },
  chaveCanonica: { type: String, required: true, unique: true },
  chavesAlternativas: { type: [String], default: [], index: true },
  aliases: { type: [String], default: [] },
  nomeBusca: { type: String, required: true },
}, {
  timestamps: true,
  collection: 'produtos',
});

// Candidatos do fuzzy match: mesmos atributos "duros", variando só o nome.
ProdutoSchema.index({ armazenamentoNormalizado: 1, corNormalizada: 1 });
ProdutoSchema.index({ categoriaId: 1, modelo: 1 });
ProdutoSchema.index({ nomeBusca: 'text', aliases: 'text' }, { default_language: 'none' });

export const ProdutoModel = mongoose.model<IProduto>('Produto', ProdutoSchema);
