import type { Wine } from '../types';

export const MOCK_WINES: Wine[] = [
  {
    id: '1',
    name: "Château Margaux 2015",
    description: "Un grand cru classé exceptionnel, notes de cassis, truffe et sous-bois.",
    image_url: "https://images.unsplash.com/photo-1584916201218-f4242ceb4809?auto=format&fit=crop&w=1350&q=80",
    prices: {
      bottle: 850,
      magnum: 1750
    },
    cepages: ["Cabernet Sauvignon", "Merlot", "Petit Verdot", "Cabernet Franc"],
    region: "Bordeaux",
    vintage: "2015",
    category: "rouge",
    bio: false
  },
  {
    id: '2',
    name: "Chablis Grand Cru Les Clos",
    description: "Un vin blanc sec, minéral et élégant avec des notes d'agrumes.",
    image_url: "https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1350&q=80",
    prices: {
      bottle: 75,
      magnum: 160
    },
    cepages: ["Chardonnay"],
    region: "Bourgogne",
    vintage: "2020",
    category: "blanc",
    bio: true
  },
  {
    id: '3',
    name: "Minuty Prestige Rosé",
    description: "Un rosé de Provence léger et fruité, parfait pour l'apéritif.",
    image_url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1350&q=80",
    prices: {
      bottle: 22,
      magnum: 48
    },
    cepages: ["Grenache", "Tibouren", "Cinsault", "Syrah"],
    region: "Provence",
    vintage: "2022",
    category: "rose",
    bio: false
  },
  {
    id: '4',
    name: "Ruinart Blanc de Blancs",
    description: "Champagne emblématique, 100% Chardonnay, notes de fruits frais et agrumes.",
    image_url: "https://images.unsplash.com/photo-1595991209266-9b870bfb2d75?auto=format&fit=crop&w=1350&q=80",
    prices: {
      bottle: 95,
      magnum: 210
    },
    cepages: ["Chardonnay"],
    region: "Champagne",
    vintage: "NM",
    category: "champagne",
    bio: false
  }
];