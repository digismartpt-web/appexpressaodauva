import { create } from 'zustand';
import { promotionsService } from '../services/supabaseService';
import type { PromotionRule } from '../types';

interface PromotionsState {
  promotions: PromotionRule[];
  allPromotions: PromotionRule[]; // For admin
  loading: boolean;
  initialized: boolean;
  initPromotionsStore: () => () => void;
}

export const usePromotionsStore = create<PromotionsState>((set, get) => ({
  promotions: [],
  allPromotions: [],
  loading: true,
  initialized: false,

  initPromotionsStore: () => {
    if (get().initialized) return () => {};
    set({ initialized: true });

    console.log('🔄 [PromotionsStore] Inicializando ouvintes globais de promoções...');

    const unsubActive = promotionsService.subscribeToActivePromotions((promotions) => {
      set({ promotions, loading: false });
    });

    const unsubAll = promotionsService.subscribeToAllPromotions((allPromotions) => {
      set({ allPromotions });
    });

    return () => {
      console.log('🔌 [PromotionsStore] Desconectando ouvintes globais de promoções...');
      unsubActive();
      unsubAll();
      set({ initialized: false });
    };
  }
}));
