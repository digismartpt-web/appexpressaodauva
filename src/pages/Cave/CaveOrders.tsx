import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Clock, CheckCircle, XCircle, Package, Truck, Phone, Mail, MapPin, Eye, Trash2, Store } from 'lucide-react';
import { ordersService } from '../../services/supabaseService';
import { useOrderStore } from '../../stores/orderStore';
import { useCaveSettings } from '../../hooks/useCaveSettings';
import { calculateDeliveryTime } from '../../services/deliveryTimeService';
import { audioNotificationService } from '../../services/audioNotificationService';
import toast from 'react-hot-toast';
import type { Order, OrderStatus } from '../../types';

const statusConfig = {
  pendente_pagamento: { label: 'Pagamento Pendente', color: 'bg-gray-100 text-gray-800', icon: Clock },
  en_attente: { label: 'Em Espera', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  confirmee: { label: 'Confirmada', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  en_preparation: { label: 'Em Preparação', color: 'bg-orange-100 text-orange-800', icon: Package },
  prete: { label: 'Pronta', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  em_entrega: { label: 'Em Entrega', color: 'bg-purple-100 text-purple-800', icon: Truck },
  recuperee: { label: 'Entregue', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelada', color: 'bg-red-100 text-red-800', icon: XCircle }
};

export function CaveOrders() {
  const { user } = useAuth();
  const { orders, loading, initAdminOrdersListener } = useOrderStore();
  const { settings } = useCaveSettings();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ordersPerPage = 20;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [preparationTime, setPreparationTime] = useState(settings?.default_preparation_time || 10);
  const [showDeliveryTimeModal, setShowDeliveryTimeModal] = useState(false);
  const [editingDeliveryOrder, setEditingDeliveryOrder] = useState<Order | null>(null);
  const [deliveryTime, setDeliveryTime] = useState(settings?.default_delivery_time || 30);
  const [deliveryDistance, setDeliveryDistance] = useState(5);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('');
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');
  const [pendingStatusChange, setPendingStatusChange] = useState<{ orderId: string; newStatus: OrderStatus } | null>(null);
  const [lastNotifiedOrderId, setLastNotifiedOrderId] = useState<string | null>(null);

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

  // Sync preparation/delivery time with settings when they load
  useEffect(() => {
    if (settings) {
      if (settings.default_preparation_time) setPreparationTime(settings.default_preparation_time);
      if (settings.default_delivery_time) setDeliveryTime(settings.default_delivery_time);
    }
  }, [settings]);

  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Alerte sonore pour les nouvelles commandes (Cave ou Admin)
  useEffect(() => {
    // Ne pas jouer de son si l'utilisateur est un ADMIN (comme demandé)
    if (user?.role === 'admin') return;

    const newOrder = orders.find(o => o.status === 'en_attente');
    
    if (newOrder) {
      if (isInitialLoad) {
        setLastNotifiedOrderId(newOrder.id);
        setIsInitialLoad(false);
        return;
      }

      if (newOrder.id !== lastNotifiedOrderId) {
        audioNotificationService.playNotification();
        if ('vibrate' in navigator) {
          navigator.vibrate([300, 100, 300]);
        }
        setLastNotifiedOrderId(newOrder.id);
      }
    }
  }, [orders, lastNotifiedOrderId, isInitialLoad, user?.role]);

  useEffect(() => {
    const unsubscribe = initAdminOrdersListener();
    return () => unsubscribe();
  }, [initAdminOrdersListener]);

  const filteredOrders = orders.filter((order) => {
    // Ne pas afficher les commandes masquées par la wineria ou en attente de paiement
    if (order.cave_hidden || order.status === 'pendente_pagamento') return false;

    if (selectedStatus === 'all') return true;
    return order.status === selectedStatus;
  });

  // Pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const order = orders.find(o => o.id === orderId);

      // Si le statut est "cancelled", ouvrir la modal de justification
      if (newStatus === 'cancelled') {
        setOrderToCancel(orderId);
        setShowCancellationModal(true);
        return;
      }

      if (newStatus === 'confirmee' && order && order.delivery_type === 'delivery') {
        setPendingStatusChange({ orderId, newStatus });
        setEditingDeliveryOrder(order);

        // Calcul automatique du temps estimé
        const calculateInitialETA = async () => {
          let travelTime = settings?.default_delivery_time || 30;
          const prepTime = order.preparation_time || settings?.default_preparation_time || 10;

          if (order.delivery_address && settings?.address) {
            toast.loading('Calculando tempo de viagem...');
            try {
              const estimate = await calculateDeliveryTime(settings.address, order.delivery_address);
              travelTime = estimate.duration;
              toast.dismiss();
            } catch (error) {
              console.error('Erro ao calcular tempo de viagem:', error);
              toast.dismiss();
              toast.error('Usando tempo padrão para viagem');
            }
          }

          const totalMinutes = prepTime + travelTime;
          const now = new Date();
          const estimatedDate = new Date(now.getTime() + totalMinutes * 60000);
          const timeString = estimatedDate.toTimeString().slice(0, 5);

          setEstimatedDeliveryTime(timeString);
          setShowDeliveryTimeModal(true);
        };

        calculateInitialETA();
        return;
      }

      // Auto-ouvrir le modal de temps de préparation pour "em preparação"
      if (newStatus === 'en_preparation' && order) {
        setPendingStatusChange({ orderId, newStatus });
        setEditingOrder(order);
        // Prioritize settings if order has no preparation time yet
        const defaultTime = settings?.default_preparation_time || 10;
        setPreparationTime(order.preparation_time || defaultTime);
        setShowTimeModal(true);
        return;
      }

      if (newStatus === 'confirmee' && order && order.delivery_type === 'pickup') {
        await ordersService.updateOrderStatus(orderId, newStatus);
        toast.success('Encomenda confirmada');
        return;
      }


      // Debug logging pour em_entrega
      if (newStatus === 'em_entrega') {
        console.log('🔍 DEBUG em_entrega:', {
          newStatus,
          hasOrder: !!order,
          deliveryType: order?.delivery_type,
          hasDeliveryAddress: !!order?.delivery_address,
          deliveryAddress: order?.delivery_address,
          hasSettings: !!settings,
          settingsAddress: settings?.address
        });
      }

      if (newStatus === 'em_entrega' && order && order.delivery_type === 'delivery' && order.delivery_address && settings) {
        setPendingStatusChange({ orderId, newStatus });
        setEditingDeliveryOrder(order);

        try {
          const estimate = await calculateDeliveryTime(
            settings.address,
            order.delivery_address
          );

          toast.dismiss();
          setDeliveryTime(estimate.duration);
          setDeliveryDistance(estimate.distance);
          setShowDeliveryTimeModal(true);
        } catch (error) {
          toast.dismiss();
          console.error('Erro ao calcular tempo de entrega:', error);
          const defDeliveryTime = settings?.default_delivery_time || 30;
          setDeliveryTime(defDeliveryTime);
          setDeliveryDistance(5);
          setShowDeliveryTimeModal(true);
          toast.error('Erro ao calcular - usando tempo padrão');
        }
        return;
      }

      // Pour tous les autres changements de statut
      if (newStatus === 'em_entrega' && order && order.delivery_type === 'pickup') {
        toast.error('Encomendas para recolha não podem ser colocadas em entrega');
        return;
      }

      await ordersService.updateOrderStatus(orderId, newStatus);
    } catch (error) {
      console.error('Erro ao atualizar o estado:', error);
    }
  };

  const handleEditPreparationTime = (order: Order) => {
    setEditingOrder(order);
    const defaultTime = settings?.default_preparation_time || 10;
    setPreparationTime(order.preparation_time || defaultTime);
    setShowTimeModal(true);
  };

  const handleUpdatePreparationTime = async () => {
    if (!editingOrder) return;

    try {
      await ordersService.updateOrderPreparationTime(editingOrder.id, preparationTime);

      // Si on a un changement de statut en attente, l'appliquer maintenant
      if (pendingStatusChange && pendingStatusChange.orderId === editingOrder.id) {
        await ordersService.updateOrderStatus(pendingStatusChange.orderId, pendingStatusChange.newStatus);
        toast.success(`Encomenda em preparação - Tempo: ${preparationTime} min`);
        setPendingStatusChange(null);
      } else {
        toast.success(`Tempo de preparação atualizado (${preparationTime} min)`);
      }

      setShowTimeModal(false);
      setEditingOrder(null);
    } catch (error) {
      console.error('Erro na atualização:', error);
      toast.error('Erro ao atualizar o tempo');
    }
  };

  const handleEditDeliveryTime = (order: Order) => {
    setEditingDeliveryOrder(order);
    setDeliveryTime(order.delivery_time || settings?.default_delivery_time || 30);
    setShowDeliveryTimeModal(true);
  };

  const handleUpdateDeliveryTime = async () => {
    if (!editingDeliveryOrder) return;

    try {
      if (pendingStatusChange && pendingStatusChange.orderId === editingDeliveryOrder.id) {
        // Cas 1: Confirmation de livraison (status 'confirmee' -> estimated delivery time)
        if (pendingStatusChange.newStatus === 'confirmee') {
          await ordersService.updateEstimatedDeliveryTime(editingDeliveryOrder.id, estimatedDeliveryTime);
          await ordersService.updateOrderStatus(pendingStatusChange.orderId, pendingStatusChange.newStatus);
          toast.success(`Encomenda confirmada - Hora prevista: ${estimatedDeliveryTime}`);
        }
        // Cas 2: Passage à "em_entrega" -> delivery time
        else if (pendingStatusChange.newStatus === 'em_entrega') {
          await ordersService.updateOrderDeliveryTime(
            editingDeliveryOrder.id,
            deliveryTime,
            deliveryDistance
          );
          await ordersService.updateOrderStatus(pendingStatusChange.orderId, pendingStatusChange.newStatus);
          toast.success(`Em entrega - Tempo estimado: ${deliveryTime} min`);
        }
        setPendingStatusChange(null);
      } else {
        // Modification manuelle du tempo de livraison
        await ordersService.updateOrderDeliveryTime(
          editingDeliveryOrder.id,
          deliveryTime,
          editingDeliveryOrder.delivery_distance || deliveryDistance
        );
        toast.success(`Tempo de entrega atualizado (${deliveryTime} min)`);
      }

      setShowDeliveryTimeModal(false);
      setEditingDeliveryOrder(null);
    } catch (error: any) {
      console.error('Erro detalhado ao atualizar tempo de entrega:', error);
      toast.error(`Erro ao atualizar o tempo: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleConfirmCancellation = async () => {
    if (!orderToCancel) return;

    try {
      await ordersService.updateOrderStatus(orderToCancel, 'cancelled', undefined, cancellationReason || undefined);
      toast.success('Encomenda cancelada');
      setShowCancellationModal(false);
      setOrderToCancel(null);
      setCancellationReason('');
    } catch (error) {
      console.error('Erro no cancelamento:', error);
      toast.error('Erro ao cancelar a encomenda');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  // Réinitialiser la page lors du changement de filtre et scroller en haut
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo(0, 0);
  }, [selectedStatus]);

  // Scroller en haut quand la page change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  const handleDeleteAllOrders = async () => {
    const correctPassword = settings?.delete_password || '';

    if (!correctPassword) {
      toast.error('Nenhuma senha de eliminação definida no Admin!');
      return;
    }

    if (password !== correctPassword) {
      toast.error('Senha incorreta!');
      return;
    }

    setIsDeleting(true);
    try {
      await ordersService.deleteAllOrders();
      toast.success('Todas as encomendas foram eliminadas com sucesso!');
      setShowDeleteModal(false);
      setPassword('');
    } catch (error) {
      console.error('Erro ao eliminar encomendas:', error);
      toast.error('Erro ao eliminar as encomendas.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Gestão de Encomendas</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as OrderStatus | 'all')}
            className="w-full sm:w-auto px-4 py-3 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            title="Filtrar encomendas por estado"
          >
            <option value="all">Todos os Estados</option>
            <option value="en_attente">Em Espera</option>
            <option value="confirmee">Confirmada</option>
            <option value="en_preparation">Em Preparação</option>
            <option value="prete">Pronta</option>
            <option value="em_entrega">Em Entrega</option>
            <option value="recuperee">Entregue</option>
            <option value="cancelled">Cancelada</option>
          </select>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-3 text-base border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition"
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Eliminar Todas
          </button>
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <Package className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma Encomenda</h3>
          <p className="mt-1 text-sm text-gray-500">
            {selectedStatus === 'all'
              ? 'Nenhuma encomenda no momento.'
              : `Nenhuma encomenda com o estado "${statusConfig[selectedStatus as OrderStatus]?.label}".`
            }
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white shadow overflow-hidden rounded-lg">
            {/* Pagination en haut si plus de 20 commandes */}
            {filteredOrders.length > ordersPerPage && (
              <div className="px-4 sm:px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700">
                    Mostrando {indexOfFirstOrder + 1} a {Math.min(indexOfLastOrder, filteredOrders.length)} de {filteredOrders.length} encomendas
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      ← Anterior
                    </button>
                    <span className="text-sm text-gray-700">
                      Página {currentPage} de {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="block sm:hidden">
              {/* Version mobile */}
              {currentOrders.map((order) => {
                const StatusIcon = statusConfig[order.status]?.icon || Clock;
                return (
                  <div key={order.id} className="p-4 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <StatusIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            #{order.order_number}
                            {order.delivery_type === 'delivery' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Entrega ao domicílio">
                                <Truck className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="Recolher no restaurante">
                                <Store className="h-3 w-3" />
                              </span>
                            )}
                            {order.status === 'confirmee' && order.delivery_type === 'delivery' && order.estimated_delivery_time && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Clock className="h-3 w-3 mr-1" />
                                {order.estimated_delivery_time}
                              </span>
                            )}
                            {order.estimated_delivery_time_confirmed && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Cliente confirmou o horário">
                                ✓
                              </span>
                            )}
                            {order.requested_later_time && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title="Cliente solicitou horário diferente">
                                ⚠ {order.requested_later_time}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusConfig[order.status]?.label || order.status}
                      </span>
                    </div>

                    <div className="mb-3">
                      <p className="font-medium text-gray-900">{order.user.full_name}</p>
                      <p className="text-sm text-gray-600">{formatPrice(order.total)}</p>
                    </div>

                    {/* Motif d'annulation - version mobile */}
                    {order.status === 'cancelled' && order.cancellation_reason && (
                      <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start">
                          <XCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-semibold text-red-900 mb-0.5">Motivo da anulação:</p>
                            <p className="text-xs text-red-800">{order.cancellation_reason}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                        className="w-full text-sm border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        title="Alterar estado da encomenda"
                      >
                        <option value="en_attente">Em Espera</option>
                        <option value="confirmee">Confirmada</option>
                        <option value="en_preparation">Em Preparação</option>
                        <option value="prete">Pronta</option>
                        {order.delivery_type !== 'pickup' && (
                          <option value="em_entrega">Em Entrega</option>
                        )}
                        <option value="recuperee">Entregue</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                      {order.status === 'en_preparation' && (
                        <button
                          onClick={() => handleEditPreparationTime(order)}
                          className="w-full inline-flex items-center justify-center px-3 py-2 border border-orange-300 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 touch-manipulation"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          {order.preparation_time || settings?.default_preparation_time || 10} min
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 touch-manipulation"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <ul className="hidden sm:block divide-y divide-gray-200">
              {currentOrders.map((order) => {
                const StatusIcon = statusConfig[order.status]?.icon || Clock;
                return (
                  <li key={order.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <StatusIcon className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-3">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              Encomenda #{order.order_number}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[order.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                              {statusConfig[order.status]?.label || order.status}
                            </span>
                            {order.delivery_type === 'delivery' ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Entrega ao domicílio">
                                <Truck className="h-4 w-4 mr-1" />
                                Entrega
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800" title="Recolher no restaurante">
                                <Store className="h-4 w-4 mr-1" />
                                Recolher
                              </span>
                            )}
                            {order.status === 'confirmee' && order.delivery_type === 'delivery' && order.estimated_delivery_time && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                <Clock className="h-4 w-4 mr-1" />
                                {order.estimated_delivery_time}
                              </span>
                            )}
                            {order.estimated_delivery_time_confirmed && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800" title="Cliente confirmou o horário">
                                ✓ Confirmado
                              </span>
                            )}
                            {order.requested_later_time && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800" title="Cliente solicitou horário diferente">
                                ⚠ Pedido: {order.requested_later_time}
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                            <span>{formatDate(order.created_at)}</span>
                            <span>{formatPrice(order.total)}</span>
                            <span>{order.user.full_name}</span>
                          </div>
                          {/* Motif d'annulation - version desktop */}
                          {order.status === 'cancelled' && order.cancellation_reason && (
                            <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                              <div className="flex items-start">
                                <XCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-xs font-semibold text-red-900">Motivo da anulação: </span>
                                  <span className="text-xs text-red-800">{order.cancellation_reason}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as OrderStatus)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          title="Alterar estado da encomenda"
                        >
                          <option value="en_attente">Em Espera</option>
                          <option value="confirmee">Confirmada</option>
                          <option value="en_preparation">Em Preparação</option>
                          <option value="prete">Pronta</option>
                          {order.delivery_type !== 'pickup' && (
                            <option value="em_entrega">Em Entrega</option>
                          )}
                          <option value="recuperee">Entregue</option>
                          <option value="cancelled">Cancelada</option>
                        </select>
                        {order.status === 'en_preparation' && (
                          <button
                            onClick={() => handleEditPreparationTime(order)}
                            className="inline-flex items-center px-3 py-1 border border-orange-300 shadow-sm text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                          >
                            <Clock className="h-4 w-4 mr-1" />
                            {order.preparation_time || settings?.default_preparation_time || 10} min
                          </button>
                        )}
                        {order.status === 'em_entrega' && (
                          <button
                            onClick={() => handleEditDeliveryTime(order)}
                            className="inline-flex items-center px-3 py-1 border border-purple-300 shadow-sm text-sm leading-4 font-medium rounded-md text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                          >
                            <Truck className="h-4 w-4 mr-1" />
                            {order.delivery_time || settings?.default_delivery_time || 30} min
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detalhes
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Pagination en bas si plus de 20 commandes */}
            {filteredOrders.length > ordersPerPage && (
              <div className="px-4 sm:px-6 py-4 border-t bg-gray-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-gray-700 text-center sm:text-left">
                    Mostrando {indexOfFirstOrder + 1} a {Math.min(indexOfLastOrder, filteredOrders.length)} de {filteredOrders.length} encomendas
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
                    >
                      ← Anterior
                    </button>

                    {/* Numéros de pages */}
                    <div className="hidden sm:flex items-center space-x-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`px-3 py-2 text-sm rounded-md transition touch-manipulation ${currentPage === pageNumber
                            ? 'bg-orange-500 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                            }`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>

                    {/* Indicateur page actuelle sur mobile */}
                    <div className="sm:hidden px-3 py-2 text-sm font-medium text-gray-700">
                      {currentPage} / {totalPages}
                    </div>

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
                    >
                      Próxima →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal de detalhes */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Detalhes da Encomenda #{selectedOrder.order_number}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600 p-2 -m-2 touch-manipulation"
                title="Fechar detalhes"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {/* Informations client */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-3">Informações do Cliente</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{selectedOrder.user.phone}</span>
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{selectedOrder.user.email}</span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.user.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {selectedOrder.user.address}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Type de livraison */}
                <div className={`p-4 rounded-lg ${selectedOrder.delivery_type === 'delivery' ? 'bg-green-50 border-2 border-green-200' : 'bg-blue-50 border-2 border-blue-200'}`}>
                  <div className="flex items-center mb-2">
                    {selectedOrder.delivery_type === 'delivery' ? (
                      <>
                        <Truck className="w-5 h-5 mr-2 text-green-700" />
                        <h4 className="font-medium text-green-900">Entrega ao domicílio</h4>
                      </>
                    ) : (
                      <>
                        <Store className="w-5 h-5 mr-2 text-blue-700" />
                        <h4 className="font-medium text-blue-900">Recolher no restaurante</h4>
                      </>
                    )}
                  </div>

                  {selectedOrder.delivery_type === 'delivery' && selectedOrder.delivery_address ? (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-green-900 mb-1">Endereço de entrega:</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.delivery_address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-green-800 hover:text-green-600 hover:underline flex items-center"
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        {selectedOrder.delivery_address}
                      </a>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-blue-900 mb-1">Local de recolha:</p>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedOrder.pickup_address || settings.address)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-800 hover:text-blue-600 hover:underline flex items-center"
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        {selectedOrder.pickup_address || settings.address}
                      </a>
                    </div>
                  )}

                  {selectedOrder.delivery_type === 'delivery' && selectedOrder.estimated_delivery_time && (
                    <div className="mt-4 space-y-2">
                      <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
                        <div className="flex items-center">
                          <Clock className="h-5 w-5 mr-2 text-blue-700" />
                          <div>
                            <p className="text-sm font-medium text-blue-900">
                              Hora de entrega proposta pela wineria: {selectedOrder.estimated_delivery_time}
                            </p>
                            {selectedOrder.estimated_delivery_time_confirmed ? (
                              <p className="text-xs text-green-700 mt-1">
                                ✓ Cliente confirmou o horário
                              </p>
                            ) : !selectedOrder.requested_later_time ? (
                              <p className="text-xs text-gray-600 mt-1">
                                Aguardando confirmação do cliente...
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {selectedOrder.requested_later_time && (
                        <div className="p-3 bg-orange-100 border border-orange-200 rounded-lg">
                          <div className="flex items-center">
                            <Clock className="h-5 w-5 mr-2 text-orange-700" />
                            <div>
                              <p className="text-sm font-medium text-orange-900">
                                Cliente solicitou entrega às: {selectedOrder.requested_later_time}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Se aceitar, mude o status para continuar o processamento
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Articles commandés */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Artigos Encomendados</h4>
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, index) => (
                      <div key={index} className="flex justify-between items-start p-3 bg-gray-50 rounded">
                        <div className="flex-1">
                          <div className="flex justify-between">
                            <span className="font-medium text-sm sm:text-base">{item.wine_name}</span>
                            <span className="font-medium text-sm sm:text-base ml-2">{formatPrice(item.price * item.quantity)}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Quantidade: {item.quantity} × {formatPrice(item.price)}
                          </div>
                          {item.size && item.size.toLowerCase() !== 'unique' && (
                            <div className="text-sm text-gray-600 mt-1">
                              Tamanho: {item.size}
                            </div>
                          )}
                          {item.wine_category && (
                            <div className="text-sm text-amber-600 font-medium mt-1">
                              📂 Categoria: {item.wine_category}
                            </div>
                          )}
                          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                            <div className="text-sm text-red-600 mt-1">
                              🚫 Sem: {item.removed_ingredients.join(', ')}
                            </div>
                          )}
                          {item.extras && item.extras.length > 0 && item.extras.some(extra => extra.name && extra.price) && (
                            <div className="text-sm text-green-600 mt-1">
                              ➕ Extras: {item.extras.map(extra => `${extra.name} (+${extra.price}€)`).join(', ')}
                            </div>
                          )}
                          {item.custom_ingredients && item.custom_ingredients.length > 0 && (
                            <div className="text-sm text-blue-600 mt-1 font-medium">
                              Ingredientes: {item.custom_ingredients.join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Detalhes de Preço */}
                <div className="border-t pt-4 space-y-2">
                  {selectedOrder.delivery_fee && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Taxa de Entrega</span>
                      <span>{formatPrice(selectedOrder.delivery_fee)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-base sm:text-lg font-bold text-gray-900">
                    <span>Total Pago</span>
                    <span>{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Motif d'annulation - modal détails */}
                {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <XCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="text-sm font-semibold text-red-900 mb-1">Encomenda Cancelada</h4>
                        <p className="text-sm text-red-800">
                          <strong>Motivo:</strong> {selectedOrder.cancellation_reason}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Statut et date */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-gray-600">
                  <span>Encomendado em {formatDate(selectedOrder.created_at)}</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[selectedOrder.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                    {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Eliminar Todas as Encomendas
              </h3>
              <div className="bg-red-50 p-4 rounded-lg mb-6">
                <p className="text-red-800 text-sm">
                  Por segurança, introduza a senha de administração para confirmar a eliminação total.
                </p>
              </div>

              <div className="mb-6">
                <label htmlFor="password" title="Label (Extra Info)" className="block text-sm font-medium text-gray-700 mb-2">
                  Senha de Confirmação
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                  placeholder="Introduza a senha..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setPassword('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAllOrders}
                  disabled={isDeleting || !password}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      A eliminar...
                    </>
                  ) : (
                    'Confirmar Eliminação Total'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de modificação do tempo de preparação */}
      {showTimeModal && editingOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-orange-100 rounded-full mb-4">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                Tempo de Preparação
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Encomenda #{editingOrder.order_number}
              </p>
              <div className="mb-6">
                <label htmlFor="prep-time" className="block text-sm font-medium text-gray-700 mb-2">
                  Tempo estimado (minutos):
                </label>
                <input
                  id="prep-time"
                  type="number"
                  min="1"
                  max="120"
                  value={preparationTime}
                  onChange={(e) => setPreparationTime(parseInt(e.target.value) || 10)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center text-2xl font-bold"
                />
                <div className="flex justify-center gap-2 mt-3">
                  <button
                    onClick={() => setPreparationTime(Math.max(1, preparationTime - 5))}
                    className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    -5 min
                  </button>
                  <button
                    onClick={() => setPreparationTime(10)}
                    className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    10 min
                  </button>
                  <button
                    onClick={() => setPreparationTime(preparationTime + 5)}
                    className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    +5 min
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowTimeModal(false);
                    setEditingOrder(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdatePreparationTime}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeliveryTimeModal && editingDeliveryOrder && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-purple-100 rounded-full mb-4">
                <Truck className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 text-center mb-2">
                {pendingStatusChange ? 'Confirmar Encomenda' : 'Tempo de Entrega'}
              </h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Encomenda #{editingDeliveryOrder.order_number}
                {pendingStatusChange && editingDeliveryOrder.delivery_address && (
                  <span className="block mt-2 text-xs">
                    <MapPin className="inline h-3 w-3 mr-1" />
                    {editingDeliveryOrder.delivery_address}
                  </span>
                )}
              </p>
              <div className="mb-6">
                {pendingStatusChange && pendingStatusChange.newStatus === 'confirmee' ? (
                  <>
                    <label htmlFor="estimated-time" className="block text-sm font-medium text-gray-700 mb-2">
                      Hora prevista de entrega:
                    </label>
                    <input
                      id="estimated-time"
                      type="time"
                      value={estimatedDeliveryTime}
                      onChange={(e) => setEstimatedDeliveryTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl font-bold"
                    />
                    <div className="flex justify-center gap-2 mt-3">
                      <button
                        onClick={() => {
                          const [hours, minutes] = estimatedDeliveryTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(hours, minutes - 15, 0);
                          setEstimatedDeliveryTime(date.toTimeString().slice(0, 5));
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        -15 min
                      </button>
                      <button
                        onClick={() => {
                          const now = new Date();
                          const estimated = new Date(now.getTime() + 30 * 60000);
                          setEstimatedDeliveryTime(estimated.toTimeString().slice(0, 5));
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        +30 min
                      </button>
                      <button
                        onClick={() => {
                          const [hours, minutes] = estimatedDeliveryTime.split(':').map(Number);
                          const date = new Date();
                          date.setHours(hours, minutes + 15, 0);
                          setEstimatedDeliveryTime(date.toTimeString().slice(0, 5));
                        }}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        +15 min
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label htmlFor="delivery-time" className="block text-sm font-medium text-gray-700 mb-2">
                      Tempo estimado (minutos):
                    </label>
                    <input
                      id="delivery-time"
                      type="number"
                      min="1"
                      max="120"
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(parseInt(e.target.value) || 30)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl font-bold"
                    />
                    <div className="flex justify-center gap-2 mt-3">
                      <button
                        onClick={() => setDeliveryTime(Math.max(1, deliveryTime - 5))}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        -5 min
                      </button>
                      <button
                        onClick={() => setDeliveryTime(30)}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        30 min
                      </button>
                      <button
                        onClick={() => setDeliveryTime(deliveryTime + 5)}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        +5 min
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeliveryTimeModal(false);
                    setEditingDeliveryOrder(null);
                    setPendingStatusChange(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateDeliveryTime}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                >
                  {pendingStatusChange ? 'Confirmar Encomenda' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Justification d'Annulation */}
      {showCancellationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cancelar Encomenda
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Por favor, indique o motivo da anulação desta encomenda. Esta mensagem será visível para o cliente.
            </p>
            <div className="mb-4">
              <label htmlFor="cancellation-reason" className="block text-sm font-medium text-gray-700 mb-2">
                Motivo da anulação
              </label>
              <textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Ruptura de stock de ingredientes..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancellationModal(false);
                  setOrderToCancel(null);
                  setCancellationReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancellation}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Confirmar Anulação
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de justification d'annulation */}
      {showCancellationModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Justificativa de Cancelamento
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Por favor, indique o motivo do cancelamento para informar o cliente.
              </p>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-accent-500 focus:border-accent-500 mb-4"
                rows={4}
                placeholder="Ex: Ingredientes esgotados, fora da zona de entrega, etc."
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCancellationModal(false);
                    setOrderToCancel(null);
                    setCancellationReason('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md"
                >
                  Voltar
                </button>
                <button
                  onClick={async () => {
                    if (!cancellationReason.trim()) {
                      toast.error('Por favor, indique um motivo');
                      return;
                    }
                    if (orderToCancel) {
                      try {
                        await ordersService.updateOrderStatus(orderToCancel, 'cancelled', undefined, cancellationReason);
                        toast.success('Encomenda cancelada');
                        setShowCancellationModal(false);
                        setOrderToCancel(null);
                        setCancellationReason('');
                      } catch (error) {
                        toast.error('Erro ao cancelar encomenda');
                      }
                    }
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Confirmar Cancelamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}