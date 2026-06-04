export interface Wine {
  nome: string;
  tipo: 'tinto' | 'branco' | 'rosé' | 'espumante' | 'porto';
  regiao: string;
  uva: string;
  preco: number;
  descricao: string;
  harmoniza: string[];
}

export const CATALOGO: Wine[] = [
  // TINTOS
  { nome: "Herdade do Rocim Amphora", tipo: "tinto", regiao: "Alentejo, Portugal", uva: "Moreto", preco: 18, descricao: "Vinho fermentado em ânfora de barro, sem madeira. Muito mineral e fresco para um tinto alentejano.", harmoniza: ["carnes grelhadas", "caça", "queijos curados", "borrego"] },
  { nome: "Quinta de Chocapalha Castelão", tipo: "tinto", regiao: "Lisboa, Portugal", uva: "Castelão", preco: 14, descricao: "Casta portuguesa pouco conhecida, com notas de frutos vermelhos e especiarias suaves.", harmoniza: ["bacalhau", "atum", "carnes vermelhas", "polvo assado"] },
  { nome: "Niepoort Nat'Cool", tipo: "tinto", regiao: "Douro, Portugal", uva: "Blend Douro", preco: 12, descricao: "Tinto leve e fresco, servido ligeiramente fresco. Muito versátil e descontraído.", harmoniza: ["petiscos", "pizza", "hambúrguer", "jantares informais"] },
  { nome: "Mencia Dominio do Bibei", tipo: "tinto", regiao: "Galiza, Espanha", uva: "Mencía", preco: 22, descricao: "Casta galega elegante e perfumada, quase desconhecida fora da região. Lembra um Pinot Noir ibérico.", harmoniza: ["polvo", "porco", "cogumelos", "aves"] },
  { nome: "Zuccardi Valle Malbec", tipo: "tinto", regiao: "Mendoza, Argentina", uva: "Malbec", preco: 19, descricao: "Malbec de altitude com frescura invulgar, longe dos taninos pesados que se associam à Argentina.", harmoniza: ["bife", "costelas", "churrasco", "queijo"] },
  // BRANCOS
  { nome: "Anselmo Mendes Contacto", tipo: "branco", regiao: "Vinho Verde, Portugal", uva: "Alvarinho", preco: 16, descricao: "Alvarinho com maceração pelicular que lhe dá textura e complexidade únicas. Muito gastronómico.", harmoniza: ["marisco", "peixe grelhado", "sushi", "mariscos"] },
  { nome: "Quinta do Ameal Loureiro", tipo: "branco", regiao: "Lima, Vinho Verde", uva: "Loureiro", preco: 13, descricao: "Loureiro é a casta mais floral de Portugal — limão, flores brancas e frescura brilhante.", harmoniza: ["linguado", "robalo", "marisco", "saladas"] },
  { nome: "Envínate Palo Blanco", tipo: "branco", regiao: "Tenerife, Espanha", uva: "Listán Blanco", preco: 28, descricao: "Um dos brancos mais excitantes de Espanha, de uma ilha vulcânica. Salino, tenso e único.", harmoniza: ["peixe cru", "ostras", "sashimi", "mariscos finos"] },
  { nome: "Domaine Weinbach Riesling", tipo: "branco", regiao: "Alsácia, França", uva: "Riesling", preco: 32, descricao: "Riesling é o branco mais incompreendido do mundo — aqui prova-se o porquê de ser um dos melhores.", harmoniza: ["porco", "especiarias", "comida asiática", "aves"] },
  { nome: "Filipa Pato Nossa Calcário", tipo: "branco", regiao: "Bairrada, Portugal", uva: "Bical", preco: 17, descricao: "Bical é uma casta quase esquecida de Portugal — aqui renascida com elegância e mineralidade.", harmoniza: ["peixe", "frango", "vegetariano", "cogumelos"] },
  // ROSÉ
  { nome: "Esporão Verdelho Rosé", tipo: "rosé", regiao: "Alentejo, Portugal", uva: "Verdelho", preco: 11, descricao: "Rosé fresco e seco com boa acidez. Perfeito para dias quentes ou refeições leves.", harmoniza: ["saladas", "grelhados leves", "salmão", "pizza"] },
  // ESPUMANTES
  { nome: "Murganheira Blanc de Blancs", tipo: "espumante", regiao: "Távora-Varosa, Portugal", uva: "Chardonnay & Fernão Pires", preco: 24, descricao: "Espumante método clássico português — pouco conhecido mas de qualidade comparável a muitos champanhes.", harmoniza: ["aperitivo", "ostras", "sushi", "celebrações", "marisco"] },
  // PORTO
  { nome: "Niepoort Colheita 2015", tipo: "porto", regiao: "Douro, Portugal", uva: "Blend Douro", preco: 38, descricao: "Porto Colheita envelhecido em cascos — rico, complexo e com notas de frutos secos e caramelo.", harmoniza: ["chocolate", "queijo azul", "sobremesas", "foie gras"] },
];
