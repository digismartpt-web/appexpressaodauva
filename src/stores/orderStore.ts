import { create } from 'zustand';
import { ordersService } from '../services/supabaseService';
import type { Order, OrderStatus } from '../types';

interface OrderState {
  orders: Order[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  fetchUserOrders: (userId: string) => Promise<void>;
  fetchAllOrders: () => Promise<void>;
  addOrder: (order: Order) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  initAdminOrdersListener: () => () => void;
  subscribeToUserOrders: (userId: string) => () => void;
  subscribeToAllOrders: () => () => void;
}


export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  loading: false,
  initialized: false,
  error: null,

  fetchUserOrders: async (userId: string) => {
    set({ loading: true });
    try {
      const orders = await ordersService.getUserOrders(userId);
      set({
        orders,
        loading: false,
        error: null
      });
    } catch (error: any) {
      set({
        error: error.message || 'Erro ao carregar encomendas',
        loading: false
      });
    }
  },

  fetchAllOrders: async () => {
    set({ loading: true });
    try {
      const orders = await ordersService.getAllOrders();
      set({
        orders,
        loading: false,
        error: null
      });
    } catch (error: any) {
      set({
        error: error.message || 'Erro ao carregar encomendas',
        loading: false
      });
    }
  },

  addOrder: (order: Order) => {
    set(state => ({
      orders: [order, ...state.orders]
    }));
  },

  updateOrderStatus: async (orderId: string, status: OrderStatus) => {
    try {
      await ordersService.updateOrderStatus(orderId, status);
      set(state => ({
        orders: state.orders.map(order =>
          order.id === orderId
            ? { ...order, status }
            : order
        )
      }));
    } catch (error: any) {
      set({
        error: error.message || 'Erro ao atualizar o estado'
      });
    }
  },

  initAdminOrdersListener: () => {
    set({ initialized: true });
    if (!get().initialized) set({ loading: true });

    // 1. Ouvinte Realtime
    const unsubscribeRealtime = ordersService.subscribeToAllOrders((orders) => {
      console.log('✅ [OrderStore] Dados atualizados via Realtime');
      set({ orders, loading: false, initialized: true, error: null });
    });

    // 2. Fallback Polling (a cada 30 segundos) - Segurança extra se o Realtime falhar
    const pollingInterval = setInterval(async () => {
      console.log('⏳ [OrderStore] Polling de segurança...');
      try {
        const orders = await ordersService.getAllOrders();
        set({ orders, loading: false, initialized: true });
      } catch (err) {
        console.warn('⚠️ [OrderStore] Falha no polling:', err);
      }
    }, 15000); // 15s - fallback pour navigateurs privés où le Realtime WebSocket peut échouer

    return () => {
      console.log('🔌 [OrderStore] Parando ouvintes e polling...');
      unsubscribeRealtime();
      clearInterval(pollingInterval);
      set({ initialized: false });
    };
  },

  subscribeToUserOrders: (userId: string) => {
    return ordersService.subscribeToUserOrders(userId, (orders) => {
      set({ orders, loading: false, error: null });
    });
  },

  // Utilisé par Admin/Orders.tsx - subscription indépendante avec fallback polling
  subscribeToAllOrders: () => {
    set({ loading: true });
    const unsubscribeRealtime = ordersService.subscribeToAllOrders((orders) => {
      set({ orders, loading: false, error: null });
    });

    const pollingInterval = setInterval(async () => {
      try {
        const orders = await ordersService.getAllOrders();
        set({ orders, loading: false });
      } catch (err) {
        console.warn('⚠️ [OrderStore/Admin] Falha no polling:', err);
      }
    }, 15000);

    return () => {
      unsubscribeRealtime();
      clearInterval(pollingInterval);
    };
  }
}));