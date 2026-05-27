import { useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Users, Clock, Package } from 'lucide-react';
import { useOrderStore } from '../../stores/orderStore';

export function CaveDashboard() {
  const { orders, initAdminOrdersListener } = useOrderStore();
  const [stats, setStats] = useState({
    total_orders: 0,
    total_revenue: 0,
    total_commissions: 0,
    average_order_value: 0,
    orders_by_status: {} as Record<string, number>
  });

  useEffect(() => {
    const unsubscribe = initAdminOrdersListener();
    return unsubscribe;
  }, [initAdminOrdersListener]);

  useEffect(() => {
    const total_orders = orders.length;
    const total_revenue = orders.reduce((sum, order) => sum + order.total, 0);
    const total_commissions = orders.reduce((sum, order) => sum + (order.commission_total || 0), 0);
    const average_order_value = total_orders > 0 ? total_revenue / total_orders : 0;

    // Compter les commandes par statut
    const orders_by_status = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setStats({
      total_orders,
      total_revenue,
      total_commissions,
      average_order_value,
      orders_by_status
    });
  }, [orders]);

  const STATUS_LABELS = {
    en_attente: 'Em Espera',
    confirmee: 'Confirmada',
    en_preparation: 'Em Preparação',
    prete: 'Pronta',
    recuperee: 'Entregue'
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-3xl font-bold text-primary-800 mb-2">Painel de Controlo</h1>
        <p className="text-primary-600">Visão geral do seu negócio</p>
      </div>

      {/* Estatísticas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          title="Total de Encomendas"
          value={stats.total_orders}
          icon={<ShoppingBag className="h-6 w-6" />}
          color="bg-blue-500"
        />
        <StatCard
          title="Receita Total"
          value={`${stats.total_revenue.toFixed(2)}€`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-green-500"
        />

        <StatCard
          title="Ticket Médio"
          value={`${stats.average_order_value.toFixed(2)}€`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-purple-500"
        />
        <StatCard
          title="Clientes Únicos"
          value={new Set(orders.map(o => o.user_id)).size}
          icon={<Users className="h-6 w-6" />}
          color="bg-orange-500"
        />
      </div>

      {/* Estados das encomendas */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Estados das Encomendas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div key={status} className="text-center p-4 bg-primary-50 rounded-lg">
              <div className="text-2xl font-bold text-primary-800">
                {stats.orders_by_status[status] || 0}
              </div>
              <div className="text-sm text-primary-600">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Encomendas recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Encomendas Recentes
          </h2>
          <div className="space-y-3">
            {orders.slice(0, 8).map((order) => (
              <div key={order.id} className="flex justify-between items-center border-b border-primary-100 pb-2">
                <div>
                  <div className="font-medium text-primary-800">
                    {order.user.full_name}
                  </div>
                  <div className="text-sm text-primary-600">
                    {new Date(order.created_at).toLocaleDateString('pt-PT', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    {order.total.toFixed(2)}€
                  </div>
                  <div className="text-sm text-primary-600">
                    {order.items.length} item(s)
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-primary-500 text-center py-4">Nenhuma encomenda</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Receitas por Dia (Últimos 7 Dias)
          </h2>
          <div className="space-y-3">
            {Array.from({ length: 7 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - i);
              const dateStr = date.toISOString().split('T')[0];

              const dayOrders = orders.filter(order =>
                order.created_at.startsWith(dateStr)
              );
              const dayRevenue = dayOrders.reduce((sum, order) => sum + order.total, 0);

              return (
                <div key={dateStr} className="flex justify-between items-center">
                  <span className="text-primary-600">
                    {date.toLocaleDateString('pt-PT', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                  <div className="text-right">
                    <div className="font-semibold text-primary-800">
                      {dayRevenue.toFixed(2)}€
                    </div>
                    <div className="text-sm text-primary-600">
                      {dayOrders.length} encomendas
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4">
        <div className={`${color} p-3 rounded-full text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-primary-600">{title}</p>
          <p className="text-2xl font-bold text-primary-800">{value}</p>
        </div>
      </div>
    </div>
  );
}