export interface Wine {
  nome: string;
  tipo: 'tinto' | 'branco' | 'rosé' | 'espumante' | 'porto';
  regiao: string;
  uva: string;
  preco: number;
  descricao: string;
  harmoniza: string[];
}

export const CATALOGO: Wine[] = [];

export function catalogoParaTexto(): string {
  return "O catálogo está vazio — estamos a preparar novidades!";
}
