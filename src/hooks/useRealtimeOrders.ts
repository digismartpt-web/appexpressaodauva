import { useEffect } from 'react';
import { useOrderStore } from '../stores/orderStore';
import { useAuth } from './useAuth';

export function useRealtimeOrders() {
  const { user } = useAuth();
  const { fetchOrders } = useOrderStore();

  useEffect(() => {
    if (!user) return;
    fetchOrders(user.id);
  }, [user]);

  return useOrderStore();
}