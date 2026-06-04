import { create } from 'zustand';
import { winesService, categoriesService, extrasService } from '../services/supabaseService';
import type { Wine, Category, Extra } from '../types';

interface WinesState {
  wines: Wine[];      // Wines ativas para o público
  allWines: Wine[];   // Todas as wines para administração
  categories: Category[];
  extras: Extra[];      // Extras ativos para o público
  allExtras: Extra[];   // Todos os extras para administração
  loading: boolean;
  initialized: boolean;
  initWinesStore: () => () => void;
}

export const useWinesStore = create<WinesState>((set, get) => ({
  wines: [],
  allWines: [],
  categories: [],
  extras: [],
  allExtras: [],
  loading: true,
  initialized: false,

  initWinesStore: () => {
    if (get().initialized) return () => {};
    set({ initialized: true });

    console.log('🔄 [WinesStore] Inicializando ouvintes globais do catálogo...');

    // DIRECT FETCH FIRST — loads data immediately, no waiting for subscriptions
    Promise.all([
      winesService.getAllWines().then(wines => ({ wines, loading: false })),
      winesService.getAllWinesForAdmin().then(allWines => ({ allWines })),
      categoriesService.getAllCategories().then(categories => ({ categories })),
      extrasService.getAllExtras().then(extras => ({ extras })),
      extrasService.getAllExtrasForAdmin().then(allExtras => ({ allExtras })),
    ]).then(results => {
      set(Object.assign({}, ...results, { loading: false }));
    }).catch(err => {
      console.error('[WinesStore] Direct fetch error:', err);
      set({ loading: false });
    });

    // Then also subscribe to realtime for live updates
    const unsubActiveWines = winesService.subscribeToActiveWines((wines) => {
      set({ wines, loading: false });
    });

    const unsubAllWines = winesService.subscribeToAllWines((allWines) => {
      set({ allWines });
    });

    const unsubCategories = categoriesService.subscribeToCategories((categories) => {
      set({ categories });
    });

    const unsubActiveExtras = extrasService.subscribeToActiveExtras((extras) => {
      set({ extras });
    });

    const unsubAllExtras = extrasService.subscribeToAllExtras((allExtras) => {
      set({ allExtras });
    });

    return () => {
      console.log('🔌 [WinesStore] Desconectando ouvintes globais do catálogo...');
      unsubActiveWines();
      unsubAllWines();
      unsubCategories();
      unsubActiveExtras();
      unsubAllExtras();
      set({ initialized: false }); // Reset so it can be re-initialized if needed
    };
  }
}));
