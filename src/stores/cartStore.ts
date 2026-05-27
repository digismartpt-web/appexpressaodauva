import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Wine, Extra, PromotionRule } from '../types';
import { promotionsService, extrasService } from '../services/supabaseService';

interface CartItem {
  id: string;
  customizationId: string;
  wine: Wine;
  size: 'small' | 'medium' | 'large';
  quantity: number;
  price: number;
  removedIngredients: string[];
  extras: Extra[];
  customIngredients: string[];
  discount?: number;
  isFree?: boolean;
}

export type DeliveryType = 'delivery' | 'pickup';

interface CartStore {
  items: CartItem[];
  promotions: PromotionRule[];
  deliveryType: DeliveryType;
  deliveryAddress: string;
  addItem: (item: { wine: Wine; size: 'small' | 'medium' | 'large'; quantity: number; removedIngredients: string[]; extras: Extra[]; customIngredients: string[]; commission?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setDeliveryType: (type: DeliveryType) => void;
  setDeliveryAddress: (address: string) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
  fetchPromotions: () => Promise<void>;
  initPromotionsListener: () => () => void;
  initExtrasListener: () => () => void;
  applyPromotions: () => void;
  syncExtras: (availableExtras: Extra[]) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      promotions: [],
      deliveryType: 'pickup',
      deliveryAddress: '',

      fetchPromotions: async () => {
        try {
          const promos = await promotionsService.getActivePromotions();
          set({ promotions: promos });
          get().applyPromotions();
        } catch (error) {
          console.error('Error fetching promotions:', error);
        }
      },

      initPromotionsListener: () => {
        return promotionsService.subscribeToActivePromotions((promos) => {
          set({ promotions: promos });
          get().applyPromotions();
        });
      },

      initExtrasListener: () => {
        return extrasService.subscribeToActiveExtras((availableExtras: Extra[]) => {
          get().syncExtras(availableExtras);
        });
      },

      syncExtras: (availableExtras) => {
        const { items } = get();
        let changed = false;

        const updatedItems = items.map(item => {
          if (!item.extras || item.extras.length === 0) return item;

          // Filtrer les extras qui ne sont plus disponibles
          const stillAvailable = item.extras.filter(selected =>
            availableExtras.some(available => available.id === selected.id)
          );

          // Mettre à jour les données (prix) des extras restants
          const updatedExtras = stillAvailable.map(selected => {
            const latest = availableExtras.find(available => available.id === selected.id);
            if (latest && (latest.price !== selected.price || latest.name !== selected.name)) {
              changed = true;
              return latest;
            }
            return selected;
          });

          if (stillAvailable.length !== item.extras.length) {
            changed = true;
          }

          if (changed) {
            // Recalculer le prix de la ligne si les extras ont changé
            const basePrice = item.wine.unique_price && item.wine.unique_price > 0
              ? item.wine.unique_price
              : item.wine.prices[item.size];
            const extrasPrice = updatedExtras.reduce((sum, extra) => sum + extra.price, 0);
            const unitPrice = basePrice + extrasPrice;
            
            return {
              ...item,
              extras: updatedExtras,
              price: unitPrice * item.quantity
            };
          }

          return item;
        });

        if (changed) {
          set({ items: updatedItems });
          get().applyPromotions();
        }
      },

      applyPromotions: () => {
        const { items, promotions } = get();

        // If there are no promotions, reset discounts and return
        if (promotions.length === 0) {
          if (items.some(item => (item.discount || 0) > 0 || item.isFree)) {
            set({ items: items.map(item => ({ ...item, discount: 0, isFree: false })) });
          }
          return;
        }

        // Reset discounts before applying
        let updatedItems = items.map(item => ({ ...item, discount: 0, isFree: false }));

        promotions.forEach(promo => {
          if (!promo.active) return;

          // Buy X get Y free logic
          if (promo.type === 'buy_x_get_y_free') {
            const buyCount = promo.buyCondition.count;
            const rewardCount = promo.reward.count;

            // 1. Identify items that qualify for the "BUY" part
            // 1. Identify items that qualify for the "BUY" part
            const buyMatchingItems = updatedItems.filter(item => {
              if (promo.buyCondition.category && item.wine.category !== promo.buyCondition.category) return false;
              if (promo.buyCondition.productIds && !promo.buyCondition.productIds.includes(item.wine.id)) return false;
              if (promo.buyCondition.size && item.size !== promo.buyCondition.size) return false;
              return true;
            });

            // 2. Identify items that qualify for the "REWARD" part
            const rewardMatchingItems = updatedItems.filter(item => {
              if (promo.reward.category && item.wine.category !== promo.reward.category) return false;
              if (promo.reward.productId && item.wine.id !== promo.reward.productId) return false;
              if (promo.reward.size && item.size !== promo.reward.size) return false;
              return true;
            });

            // Check if there is an overlap between the "BUY" set and the "REWARD" set
            const hasOverlap = buyMatchingItems.some(buyItem =>
              rewardMatchingItems.some(rewardItem => rewardItem.id === buyItem.id)
            );

            let occurrences = 0;
            if (hasOverlap) {
              // If they overlap (e.g., Buy 2 Wines Get 1 Wine Free), 
              // the total count required is buyCount + rewardCount
              const unionItems = Array.from(new Set([...buyMatchingItems, ...rewardMatchingItems]));
              const totalQuantity = unionItems.reduce((sum, item) => sum + item.quantity, 0);
              occurrences = Math.floor(totalQuantity / (buyCount + rewardCount));
            } else {
              // If they are disjoint (e.g., Buy 2 Wines Get 1 Soda Free),
              // we only need buyCount items to trigger the reward
              const totalBuyQuantity = buyMatchingItems.reduce((sum, item) => sum + item.quantity, 0);
              occurrences = Math.floor(totalBuyQuantity / buyCount);
            }

            if (occurrences > 0) {
              const totalFreeItemsAllowed = occurrences * rewardCount;

              // Apply discount to the cheapest available reward items
              let remainingFree = totalFreeItemsAllowed;

              // Sort reward items by unit price (including extras) ascending
              const sortedRewards = [...rewardMatchingItems].sort((a, b) => (a.price / a.quantity) - (b.price / b.quantity));

              for (const reward of sortedRewards) {
                if (remainingFree <= 0) break;

                const itemIdx = updatedItems.findIndex(i => i.id === reward.id);
                if (itemIdx !== -1) {
                  const item = updatedItems[itemIdx];
                  const unitPrice = item.price / item.quantity;
                  const freeInThisItem = Math.min(item.quantity, remainingFree);

                  updatedItems[itemIdx] = {
                    ...item,
                    discount: (item.discount || 0) + (unitPrice * freeInThisItem),
                    isFree: freeInThisItem === item.quantity && item.quantity === 1
                  };
                  remainingFree -= freeInThisItem;
                }
              }
            }
          }
        });

        set({ items: updatedItems });
      },

      addItem: ({ wine, size, quantity, removedIngredients, extras, customIngredients }) => {
        const state = get();
        const basePrice = wine.unique_price && wine.unique_price > 0
          ? wine.unique_price
          : wine.prices[size];
        const extrasPrice = extras.reduce((sum, extra) => sum + extra.price, 0);
        const unitPrice = basePrice + extrasPrice;
        const totalLinePrice = unitPrice * quantity;

        const customizationId = `${wine.id}-${size}-${JSON.stringify(removedIngredients.sort())}-${JSON.stringify(extras.sort())}-${JSON.stringify(customIngredients.sort())}`;

        const existingItem = state.items.find(item => item.customizationId === customizationId);

        if (existingItem) {
          set({
            items: state.items.map(item =>
              item.customizationId === customizationId
                ? { ...item, quantity: item.quantity + quantity, price: item.price + totalLinePrice }
                : item
            )
          });
        } else {
          const newItem: CartItem = {
            id: `${Date.now()}-${Math.random()}`,
            customizationId,
            wine,
            size,
            quantity,
            price: totalLinePrice,
            removedIngredients,
            extras,
            customIngredients
          };

          set({
            items: [...state.items, newItem]
          });
        }
        get().applyPromotions();
      },

      removeItem: (id: string) => {
        set(state => ({
          items: state.items.filter(item => item.id !== id)
        }));
        get().applyPromotions();
      },

      updateQuantity: (id: string, quantity: number) => {
        const state = get();
        const item = state.items.find(i => i.id === id);
        if (!item) return;

        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }

        const unitPrice = item.price / item.quantity;
        set({
          items: state.items.map(i =>
            i.id === id ? { ...i, quantity, price: unitPrice * quantity } : i
          )
        });
        get().applyPromotions();
      },

      setDeliveryType: (type: DeliveryType) => {
        set({ deliveryType: type });
        if (type === 'pickup') {
          set({ deliveryAddress: '' });
        }
      },

      setDeliveryAddress: (address: string) => {
        set({ deliveryAddress: address });
      },

      clearCart: () => {
        set({ items: [], deliveryType: 'pickup', deliveryAddress: '' });
      },

      getTotal: () => {
        const state = get();
        const subtotal = state.items.reduce((total, item) => total + item.price, 0);
        const totalDiscount = state.items.reduce((total, item) => total + (item.discount || 0), 0);
        return Math.max(0, subtotal - totalDiscount);
      },

      getItemCount: () => {
        const state = get();
        return state.items.reduce((count, item) => count + item.quantity, 0);
      }
    }),
    {
      name: 'cart-storage',
      partialize: (state) => ({
        items: state.items,
        deliveryType: state.deliveryType,
        deliveryAddress: state.deliveryAddress
      }),
    }
  )
);