import { useState, useEffect } from 'react';
import { Clock, Package, CheckCircle, XCircle, Eye, Phone, Mail, MapPin, Truck, Store, CreditCard, Loader2, BellRing } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useCaveSettings } from '../hooks/useCaveSettings';
import { ordersService } from '../services/supabaseService';
import { checkOpeningHours } from '../services/openingHoursService';
import { audioNotificationService } from '../services/audioNotificationService';
import type { Order } from '../types';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pendente_pagamento: {
    label: 'A aguardar pagamento',
    color: 'bg-gray-100 text-gray-800',
    icon: Clock
  },
  en_attente: {
    label: 'Em espera',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock
  },
  confirmee: {
    label: 'Confirmado',
    color: 'bg-blue-100 text-blue-800',
    icon: CheckCircle
  },
  en_preparation: {
    label: 'Em preparação',
    color: 'bg-orange-100 text-orange-800',
    icon: Package
  },
  prete: {
    label: 'Pronto',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle
  },
  em_entrega: {
    label: 'Em entrega',
    color: 'bg-purple-100 text-purple-800',
    icon: Truck
  },
  recuperee: {
    label: 'Entregue',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle
  },
  cancelled: {
    label: 'Cancelado',
    color: 'bg-red-100 text-red-800',
    icon: XCircle
  }
};

export default function MesCommandes() {
  const { user } = useAuth();
  const { settings } = useCaveSettings();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showTimeConfirmModal, setShowTimeConfirmModal] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState<Order | null>(null);
  const [requestedLaterTime, setRequestedLaterTime] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [lastNotifiedOrderId, setLastNotifiedOrderId] = useState<string | null>(null);

  // Déverrouiller l'audio au premier clic
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

  useEffect(() => {
    if (!user?.id) return;

    const unsubscribe = ordersService.subscribeToUserOrders(user.id, (userOrders) => {
      setOrders(userOrders);
      setLoading(false);

      // Chercher une commande qui nécessite confirmation de l'horaire
      // On élargit à "en_preparation" au cas où la wineria a déjà commencé
      const needsConfirmation = userOrders.find(
        order => (order.status === 'confirmee' || order.status === 'en_preparation') &&
          order.delivery_type === 'delivery' &&
          order.estimated_delivery_time &&
          order.estimated_delivery_time.trim() !== '' &&
          !order.estimated_delivery_time_confirmed &&
          !order.requested_later_time
      );

      if (needsConfirmation) {
        // Alerte sonore et vibration si c'est une nouvelle notification
        if (lastNotifiedOrderId !== needsConfirmation.id) {
          audioNotificationService.playClientNotification();
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
          setLastNotifiedOrderId(needsConfirmation.id);
        }

        if (!confirmingOrder || confirmingOrder.id !== needsConfirmation.id) {
          setConfirmingOrder(needsConfirmation);
          const [hours, minutes] = needsConfirmation.estimated_delivery_time!.split(':').map(Number);
          const suggestedTime = new Date();
          suggestedTime.setHours(hours, minutes + 15, 0);
          setRequestedLaterTime(suggestedTime.toTimeString().slice(0, 5));
          setShowTimeConfirmModal(true);
        }
      } else {
        if (showTimeConfirmModal) setShowTimeConfirmModal(false);
        if (confirmingOrder) setConfirmingOrder(null);
        setLastNotifiedOrderId(null);
      }
    });

    return unsubscribe;
  }, [user?.id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price: number) => {
    return `${price.toFixed(2)} €`;
  };

  const handleConfirmTime = async () => {
    if (!confirmingOrder) {
      console.warn('⚠️ handleConfirmTime called without confirmingOrder');
      return;
    }

    try {
      console.log('🚀 Confirming time for order:', confirmingOrder.id);
      await ordersService.confirmEstimatedDeliveryTime(confirmingOrder.id);
      console.log('✅ Time confirmed successfully');
      alert('Horário confirmado com sucesso!');
      setShowTimeConfirmModal(false);
      setConfirmingOrder(null);
    } catch (error: any) {
      console.error('❌ Erro ao confirmar horário:', error);
      alert(`Erro ao confirmar horário: ${error.message || 'Desconhecido'}`);
    }
  };

  const handleRequestLaterTime = async () => {
    if (!confirmingOrder) {
      console.warn('⚠️ handleRequestLaterTime called without confirmingOrder');
      return;
    }

    if (!requestedLaterTime) {
      alert('Por favor, selecione um horário.');
      return;
    }

    try {
      console.log('🚀 Requesting later time:', requestedLaterTime, 'for order:', confirmingOrder.id);
      await ordersService.requestLaterDeliveryTime(confirmingOrder.id, requestedLaterTime);
      console.log('✅ Later time requested successfully');
      alert(`Solicitação de entrega às ${requestedLaterTime} enviada!`);
      setShowTimeConfirmModal(false);
      setConfirmingOrder(null);
    } catch (error: any) {
      console.error('❌ Erro ao solicitar nouveau horário:', error);
      alert(`Erro ao solicitar novo horário: ${error.message || 'Desconhecido'}`);
    }
  };

  const handlePayNow = async (order: Order) => {
    // Vérification de l'ouverture du restaurant
    let openingHoursCheck: any = { isOpen: false, message: 'Horários não configurados' };
    try {
      if (settings?.opening_hours) {
        openingHoursCheck = checkOpeningHours(settings.opening_hours, settings.cutoff_minutes_before_closing);
      }
    } catch (error) {
      console.error('Erro ao verificar horários:', error);
    }

    const canOrder = settings?.is_open && openingHoursCheck.isOpen;

    if (!canOrder) {
      if (settings && !settings.is_open) {
        alert('⚠️ O restaurante encontra-se encerrado de momento. Não é possível processar pagamentos.');
      } else {
        const msg = (openingHoursCheck as any).message || 'O restaurante encontra-se fora do horário de atendimento.';
        alert(`⚠️ ${msg}`);
      }
      return;
    }

    setIsProcessingPayment(order.id);
    try {
      console.log('🚀 Iniciando pagamento pendente para ordem:', order.id);

      // Reconstruire les items Stripe avec la taxa de entrega si applicable
      // (identique à CartModal pour garantir la cohérence du montant Stripe)
      const stripeItems = [...order.items];
      if (order.delivery_type === 'delivery' && order.delivery_fee && order.delivery_fee > 0) {
        stripeItems.push({
          wine_id: 'taxa-entrega',
          wine_name: 'Taxa de Entrega',
          wine_category: 'Serviço',
          size: 'medium',
          quantity: 1,
          price: order.delivery_fee,
          extras: [],
          removed_ingredients: [],
          custom_ingredients: []
        } as any);
      }
      
      const sessionData = await ordersService.createStripeSession(
        order.id,
        stripeItems,
        order.user.email
      );

      if (sessionData && sessionData.url) {
        window.location.href = sessionData.url;
      } else {
        throw new Error('Falha ao gerar link de pagamento');
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar pagamento:', error);
      alert(`Erro ao processar o pagamento: ${error.message || 'Tente novamente mais tarde'}`);
    } finally {
      setIsProcessingPayment(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">A carregar as suas encomendas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Banner dinâmico: Só aparece se houver entrega pendente de confirmação */}
        {orders.some(o => o.delivery_type === 'delivery' && o.status === 'en_attente' && !o.estimated_delivery_time_confirmed) && (
          <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 rounded-2xl p-5 sm:p-6 mb-8 shadow-xl border border-white/10 group">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-all duration-500"></div>
            <div className="relative flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
                <BellRing className="w-6 h-6 text-white animate-bounce-subtle" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-extrabold text-base sm:text-lg tracking-tight uppercase mb-1">
                  Confirmação de Horário Necessária
                </h3>
                <p className="text-indigo-50 text-sm sm:text-base leading-relaxed">
                  Para a sua entrega, fique atento a esta página. Precisará de <strong>confirmar o horário</strong> na aplicação assim que a wineria fizer uma proposta.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">As Minhas Encomendas</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">
            Acompanhe o estado das suas encomendas em tempo real
          </p>
        </div>

        {/* Bannière de notification persistante si une confirmation est attendue */}
        {confirmingOrder && (
          <div className="mb-6 bg-accent-600 shadow-lg rounded-lg overflow-hidden animate-bounce-subtle">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                <div className="bg-white p-2 rounded-full mr-3">
                  <BellRing className="w-5 h-5 text-accent-600 animate-pulse" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm sm:text-base">
                    Confirme o seu horário de entrega!
                  </p>
                  <p className="text-accent-100 text-xs sm:text-sm">
                    A wineria propôs as {confirmingOrder.estimated_delivery_time}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowTimeConfirmModal(true)}
                className="bg-white text-accent-600 px-4 py-2 rounded-md font-bold text-sm hover:bg-accent-50 transition-colors"
              >
                Ver Agora
              </button>
            </div>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma encomenda
            </h3>
            <p className="text-gray-600">
              Ainda não fez nenhuma encomenda.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const status = statusConfig[order.status];
              const StatusIcon = status?.icon || Clock;

              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <StatusIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            Encomenda #{order.order_number}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {formatDate(order.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:space-x-3">
                        <div className="flex flex-col gap-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${status?.color || 'bg-gray-100 text-gray-800'}`}>
                            {status?.label || order.status}
                          </span>
                          {order.status === 'confirmee' && order.delivery_type === 'delivery' && (order.requested_later_time || order.estimated_delivery_time) && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                              <Clock className="w-4 h-4 mr-1" />
                              Entrega às {order.requested_later_time || order.estimated_delivery_time}
                            </span>
                          )}
                          {order.status === 'en_preparation' && order.preparation_time && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                              <Clock className="w-4 h-4 mr-1" />
                              {order.preparation_time} minutos
                            </span>
                          )}
                          {order.status === 'em_entrega' && order.delivery_time && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                              <Truck className="w-4 h-4 mr-1" />
                              {order.delivery_time} minutos
                            </span>
                          )}
                        </div>

                        {order.status === 'pendente_pagamento' && (
                          <button
                            onClick={() => handlePayNow(order)}
                            disabled={isProcessingPayment === order.id}
                            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent shadow-sm text-sm leading-4 font-bold rounded-md text-white bg-accent-600 hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 touch-manipulation disabled:opacity-50"
                          >
                            {isProcessingPayment === order.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <CreditCard className="w-4 h-4 mr-2" />
                            )}
                            Pagar Agora
                          </button>
                        )}

                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 touch-manipulation"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Detalhes
                        </button>
                      </div>
                    </div>

                    {/* Message d'annulation en pleine largeur sous le header */}
                    {order.status === 'cancelled' && order.cancellation_reason && (
                      <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-start">
                          <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-red-900 mb-1">
                              Motivo da anulação:
                            </p>
                            <p className="text-sm text-red-800">
                              {order.cancellation_reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-gray-600">
                            {order.items.length} item{order.items.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-gray-900">
                            {formatPrice(order.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal de détails */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Detalhes da encomenda #{selectedOrder.order_number}
                  </h3>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Fechar detalhes"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Statut */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Estado</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedOrder.status]?.color || 'bg-gray-100 text-gray-800'}`}>
                        {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                      </span>
                      {selectedOrder.status === 'confirmee' && selectedOrder.delivery_type === 'delivery' && (selectedOrder.requested_later_time || selectedOrder.estimated_delivery_time) && (
                        <div className="flex flex-col gap-2">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            <Clock className="w-4 h-4 mr-1" />
                            Entrega prevista às {selectedOrder.requested_later_time || selectedOrder.estimated_delivery_time}
                          </span>
                          {selectedOrder.requested_later_time && selectedOrder.estimated_delivery_time && (
                            <span className="text-xs text-gray-500 ml-1">
                              (Horário original proposto: {selectedOrder.estimated_delivery_time})
                            </span>
                          )}
                        </div>
                      )}
                      {selectedOrder.status === 'en_preparation' && selectedOrder.preparation_time && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                          <Clock className="w-4 h-4 mr-1" />
                          Tempo estimado: {selectedOrder.preparation_time} minutos
                        </span>
                      )}
                      {selectedOrder.status === 'em_entrega' && selectedOrder.delivery_time && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                          <Truck className="w-4 h-4 mr-1" />
                          Tempo estimado: {selectedOrder.delivery_time} minutos
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Informations de livraison */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Informações de entrega</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        {selectedOrder.user.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        {selectedOrder.user.email}
                      </div>
                      <div className="flex items-start text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 mt-0.5" />
                        <div>
                          <strong>Nome completo:</strong> {selectedOrder.user.full_name}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Type de livraison */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Tipo de Entrega</h4>
                    <div className={`p-4 rounded-lg ${selectedOrder.delivery_type === 'delivery' ? 'bg-green-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center mb-2">
                        {selectedOrder.delivery_type === 'delivery' ? (
                          <>
                            <Truck className="w-5 h-5 mr-2 text-green-700" />
                            <span className="font-medium text-green-900">Entrega ao domicílio</span>
                          </>
                        ) : (
                          <>
                            <Store className="w-5 h-5 mr-2 text-blue-700" />
                            <span className="font-medium text-blue-900">Levantar no restaurante</span>
                          </>
                        )}
                      </div>

                      {selectedOrder.delivery_type === 'delivery' && selectedOrder.delivery_address ? (
                        <div className="mt-3">
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
                        <div className="mt-3">
                          <p className="text-sm font-medium text-blue-900 mb-1">Local de levantamento:</p>
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
                    </div>
                  </div>

                  {/* Message d'annulation */}
                  {selectedOrder.status === 'cancelled' && selectedOrder.cancellation_reason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <XCircle className="w-5 h-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-red-900 mb-1">
                            Encomenda Cancelada
                          </h4>
                          <p className="text-sm text-red-800">
                            <strong>Motivo:</strong> {selectedOrder.cancellation_reason}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Articles */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Artigos encomendados</h4>
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-medium text-gray-900">{item.wine_name}</h5>
                            <span className="text-sm font-medium text-gray-900">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            Quantidade: {item.quantity} × {formatPrice(item.price)}
                          </p>
                          {item.size && item.size.toLowerCase() !== 'unique' && (
                            <p className="text-sm text-gray-600">Tamanho: {item.size}</p>
                          )}
                          {item.wine_category && (
                            <p className="text-sm text-amber-600 font-medium mb-2">
                              📂 Categoria: {item.wine_category}
                            </p>
                          )}
                          {item.removed_ingredients && item.removed_ingredients.length > 0 && (
                            <div className="text-sm text-red-600 mb-2">
                              <strong>Ingredientes removidos:</strong> {item.removed_ingredients.join(', ')}
                            </div>
                          )}
                          {item.extras && item.extras.length > 0 && item.extras.some(extra => extra.name && extra.price) && (
                            <div className="text-sm text-green-600 mb-2">
                              <strong>Extras adicionados:</strong> {item.extras.map(extra => `${extra.name} (+${extra.price}€)`).join(', ')}
                            </div>
                          )}
                          {item.custom_ingredients && item.custom_ingredients.length > 0 && (
                            <div className="text-sm text-blue-600 font-medium">
                              <strong>Ingredientes:</strong> {item.custom_ingredients.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t pt-4 space-y-2">
                    {selectedOrder.delivery_type === 'delivery' && selectedOrder.delivery_fee && selectedOrder.delivery_fee > 0 ? (
                      <div className="flex justify-between items-center text-sm text-gray-600">
                        <span>Taxa de entrega</span>
                        <span>{formatPrice(selectedOrder.delivery_fee)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-900">Total</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {formatPrice(selectedOrder.total)}
                      </span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-sm text-gray-600">
                    <strong>Encomendado em:</strong> {formatDate(selectedOrder.created_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de confirmation d'horaire */}
        {showTimeConfirmModal && confirmingOrder && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-900">
                    Confirmar horário de entrega
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-lg text-gray-900 mb-2">
                      Encomenda #{confirmingOrder.order_number}
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      Entrega prevista às {confirmingOrder.estimated_delivery_time}
                    </p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-gray-700">
                      Este horário é conveniente para si?
                    </p>

                    <button
                      onClick={handleConfirmTime}
                      className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-lg"
                    >
                      ✓ Sim, perfeito!
                    </button>

                    <div className="border-t pt-4">
                      <p className="text-gray-700 mb-3">
                        Precisa de mais tempo? Solicite uma entrega mais tarde:
                      </p>

                      <div className="flex gap-3 mb-3">
                        <input
                          type="time"
                          id="requested-later-time"
                          name="requested-later-time"
                          value={requestedLaterTime}
                          onChange={(e) => setRequestedLaterTime(e.target.value)}
                          min={confirmingOrder.estimated_delivery_time}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl font-bold"
                          title="Escolher novo horário de entrega"
                        />
                      </div>

                      <div className="flex justify-center gap-2 mb-3">
                        <button
                          onClick={() => {
                            const [hours, minutes] = confirmingOrder.estimated_delivery_time!.split(':').map(Number);
                            const newTime = new Date();
                            newTime.setHours(hours, minutes + 15, 0);
                            setRequestedLaterTime(newTime.toTimeString().slice(0, 5));
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          +15 min
                        </button>
                        <button
                          onClick={() => {
                            const [hours, minutes] = confirmingOrder.estimated_delivery_time!.split(':').map(Number);
                            const newTime = new Date();
                            newTime.setHours(hours, minutes + 30, 0);
                            setRequestedLaterTime(newTime.toTimeString().slice(0, 5));
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          +30 min
                        </button>
                        <button
                          onClick={() => {
                            const [hours, minutes] = confirmingOrder.estimated_delivery_time!.split(':').map(Number);
                            const newTime = new Date();
                            newTime.setHours(hours + 1, minutes, 0);
                            setRequestedLaterTime(newTime.toTimeString().slice(0, 5));
                          }}
                          className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          +1 hora
                        </button>
                      </div>

                      <button
                        onClick={handleRequestLaterTime}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Solicitar entrega às {requestedLaterTime}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}