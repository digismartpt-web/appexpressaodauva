import { useState, useEffect } from 'react';
import { Search, MapPin, Trash2 } from 'lucide-react';
import { useOrderStore } from '../../stores/orderStore';
import { ordersService } from '../../services/supabaseService';
import { audioNotificationService } from '../../services/audioNotificationService';
import toast from 'react-hot-toast';
import type { OrderStatus } from '../../types';

const STATUS_LABELS = {
  en_attente: 'Em Espera',
  confirmee: 'Confirmada',
  en_preparation: 'Em Preparação',
  prete: 'Pronta',
  recuperee: 'Entregue'
};

export function Orders() {
  const { orders, subscribeToAllOrders, updateOrderStatus } = useOrderStore();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = subscribeToAllOrders();
    
    return () => {
      if (unsub) unsub();
    };
  }, [subscribeToAllOrders]);


  // Déverrouiller l'audio au premier clic/touche
  useEffect(() => {
    const unlock = () => {
      audioNotificationService.unlockAudio();
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Notificações sonoras desativadas na vista Admin
  const filteredOrders = orders
    .filter(order => order.status !== 'pendente_pagamento' && !order.admin_hidden)
    .filter(order =>
      (order.user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.order_number || '').toString().includes(searchTerm)
    )
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-primary-800">Gestão de encomendas</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Pesquisar por nome ou número de encomenda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Número</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Cliente</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Artigos</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Total</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-primary-600">
                    Nenhuma encomenda encontrada
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-primary-50">
                    <td className="px-6 py-4 text-sm text-primary-800">#{order.order_number}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-primary-800">{order.user.full_name || 'Sem nome'}</div>
                      <div className="text-sm text-primary-600">{order.user.phone}</div>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.user.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                      >
                        <MapPin className="h-3 w-3 mr-1" />
                        {order.user.address}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      {(order.items || []).map((item, index) => (
                        <div key={index} className="text-sm text-primary-600">
                          {item.quantity}x {item.wine_name} ({item.size})
                        </div>
                      ))}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-primary-800">
                      {(order.total || 0).toFixed(2)}€
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={order.status}
                          onChange={(e) => updateOrderStatus(order.id.toString(), e.target.value as OrderStatus)}
                          aria-label="Estado da encomenda"
                          title="Estado da encomenda"
                          className="text-sm border border-primary-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-accent-500"
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={async () => {
                            if (window.confirm('Tem a certeza de que pretende eliminar definitivamente esta encomenda?')) {
                              try {
                                await ordersService.deleteOrder(order.id.toString());
                                toast.success('Encomenda eliminada com sucesso');
                              } catch (e: any) {
                                toast.error('Erro ao eliminar a encomenda');
                                console.error(e);
                              }
                            }
                          }}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                          title="Remover do painel admin (não afeta a wineria)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}