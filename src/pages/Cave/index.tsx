import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CaveSidebar } from './CaveSidebar';
import { CaveDashboard } from './CaveDashboard';
import { CaveOrders } from './CaveOrders';
import { CaveMenu } from './CaveMenu';
import { CaveCategories } from './CaveCategories';
import { CavePromotions } from './CavePromotions';
import { CaveSettings } from './CaveSettings';
import { audioNotificationService } from '../../services/audioNotificationService';
import { ordersService } from '../../services/supabaseService';
import toast from 'react-hot-toast';

export function Cave() {
  const previousOrderIdsRef = useRef<Set<string>>(new Set());

  // Déverrouiller l'audio au premier clic de l'utilisateur (obligation navigateur)
  useEffect(() => {
    const unlock = () => {
      audioNotificationService.unlockAudio();
      document.removeEventListener('click', unlock);
    };
    document.addEventListener('click', unlock);
    return () => document.removeEventListener('click', unlock);
  }, []);

  useEffect(() => {
    // S'abonner aux commandes dès l'arrivée sur l'interface wineria
    const unsubscribe = ordersService.subscribeToAllOrders((newOrders) => {
      const currentOrderIds = previousOrderIdsRef.current;

      // Détecter les nouvelles commandes en attente
      const hasNewOrders = newOrders.some(order =>
        !currentOrderIds.has(order.id) && order.status === 'en_attente'
      );

      // Jouer le som e notification para novas encomendas
      if (hasNewOrders && currentOrderIds.size > 0) {
        audioNotificationService.playNotification();
        toast.success('Nova encomenda recebida!', {
          duration: 4000,
        });
      }

      // Atualizar a lista de IDs
      previousOrderIdsRef.current = new Set(newOrders.map(o => o.id));
    });

    return unsubscribe;
  }, []);

  return (
    <div className="flex h-full min-h-screen">
      <CaveSidebar />
      <div className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/wineria/commandes" replace />} />
          <Route path="commandes" element={<CaveOrders />} />
          <Route path="menu" element={<CaveMenu />} />
          <Route path="categorias" element={<CaveCategories />} />
          <Route path="promocoes" element={<CavePromotions />} />
          <Route path="configuracoes" element={<CaveSettings />} />
        </Routes>
      </div>
    </div>
  );
}