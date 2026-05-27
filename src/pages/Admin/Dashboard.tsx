import { useEffect, useState } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Save, Key, Download, FileText, Clock, Trash2 } from 'lucide-react';
import { useOrderStore } from '../../stores/orderStore';
import { useCaveSettings } from '../../hooks/useCaveSettings';
import { audioNotificationService } from '../../services/audioNotificationService';
import { ordersService } from '../../services/supabaseService';
import toast from 'react-hot-toast';

export function Dashboard() {
  const { orders, initAdminOrdersListener } = useOrderStore();
  const { settings: firestoreSettings, updateSettings } = useCaveSettings();
  
  const [stats, setStats] = useState({
    total_orders: 0,
    total_gross_revenue: 0,
    total_cave_share: 0,
    total_commission: 0,
    average_order_value: 0,
    orders_by_status: {} as Record<string, number>
  });

  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [deletePassword, setDeletePassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  // Alerte sonore pour les nouvelles commandes (même logique que la wineria)
  useEffect(() => {
    const newOrder = orders.find(o => o.status === 'en_attente');
    if (newOrder && newOrder.id !== lastNotifiedOrderId) {
      audioNotificationService.playNotification();
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300]);
      }
      setLastNotifiedOrderId(newOrder.id);
    }
  }, [orders, lastNotifiedOrderId]);

  useEffect(() => {
    const unsubscribe = initAdminOrdersListener();
    return unsubscribe;
  }, [initAdminOrdersListener]);

  useEffect(() => {
    setDeletePassword(firestoreSettings.delete_password || '');
  }, [firestoreSettings]);

  // Fonction pour obtenir le numéro de semaine ISO
  const getWeekNumber = (d: Date) => {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${weekNo}`;
  };

  useEffect(() => {
    // Filtrar ordens abandonnées no carrinho
    const validOrders = orders.filter(o => o.status !== 'pendente_pagamento' && !o.admin_hidden);
    const paidStatuses = ['en_attente', 'confirmee', 'en_preparation', 'prete', 'em_entrega', 'recuperee'];
    const paidOrders = validOrders.filter(o => paidStatuses.includes(o.status));

    // Cálculos Globais (Histórico)
    const total_orders = validOrders.length;
    const total_gross_revenue = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const total_commission = total_gross_revenue * 0.10;
    const total_cave_share = total_gross_revenue - total_commission;
    const average_order_value = total_orders > 0 ? total_gross_revenue / total_orders : 0;

    // Estatísticas por Semana
    const weeklyMap = new Map();
    paidOrders.forEach(order => {
      const weekKey = getWeekNumber(new Date(order.created_at));
      if (!weeklyMap.has(weekKey)) {
        weeklyMap.set(weekKey, { week: weekKey, gross: 0, commission: 0, count: 0 });
      }
      const data = weeklyMap.get(weekKey);
      data.gross += (order.total || 0);
      data.commission += (order.total || 0) * 0.10;
      data.count += 1;
    });

    const sortedWeekly = Array.from(weeklyMap.values()).sort((a, b) => b.week.localeCompare(a.week));

    // Estatísticas por Status (Excluindo abandonadas)
    const orders_by_status = validOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setStats({
      total_orders,
      total_gross_revenue,
      total_cave_share,
      total_commission,
      average_order_value,
      orders_by_status
    });

    setWeeklyStats(sortedWeekly);
  }, [orders]);

  const STATUS_LABELS = {
    pendente_pagamento: 'Pendente Pagto',
    en_attente: 'Em Espera',
    confirmee: 'Confirmada',
    en_preparation: 'Em Preparação',
    prete: 'Pronta',
    em_entrega: 'Em Entrega',
    recuperee: 'Entregue',
    cancelled: 'Cancelada'
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      if (!deletePassword.trim()) {
        setMessage({ type: 'error', text: 'A senha não pode estar vazia' });
        setIsSaving(false);
        return;
      }
      const success = await updateSettings({ delete_password: deletePassword });
      if (success) {
        setMessage({ type: 'success', text: 'Senha guardada com sucesso!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao guardar a senha' });
      }
    } catch (error: any) {
      console.error('Erro ao guardar:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao guardar a senha' });
    } finally {
      setIsSaving(false);
    }
  };

  const exportToCSV = (onlyWeekly: boolean) => {
    const validExportOrders = orders.filter(o => o.status !== 'pendente_pagamento');
    const dataToExport = onlyWeekly
      ? validExportOrders.filter(o => {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return new Date(o.created_at) >= sevenDaysAgo;
        })
      : validExportOrders;

    if (dataToExport.length === 0) {
      alert('Nenhuma encomenda para exportar');
      return;
    }

    const headers = [
      'Nº Encomenda', 'Data', 'Clente', 'Total (€)', 'Comissão 10% (€)', 'Parte Wine 90% (€)', 'Estado', 'Tipo'
    ];

    const csvContent = [
      headers.join(';'),
      ...dataToExport.map(o => [
        o.order_number,
        new Date(o.created_at).toLocaleString('pt-PT'),
        `"${o.user.full_name}"`,
        (o.total || 0).toFixed(2),
        ((o.total || 0) * 0.10).toFixed(2),
        ((o.total || 0) * 0.90).toFixed(2),
        o.status,
        o.delivery_type
      ].join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comissoes_${onlyWeekly ? 'semanal' : 'total'}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const handleHideOrder = async (orderId: string) => {
    if (window.confirm('Tem a certeza de que pretende remover esta linha do seu registo de facturação? Esta ação não afectará a visualização da wineria.')) {
      try {
        await ordersService.hideOrderForAdmin(orderId);
        toast.success('Registo removido do seu painel');
      } catch (error) {
        console.error('Erro ao ocultar:', error);
        toast.error('Erro ao remover o registo');
      }
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (window.confirm('Tem a certeza de que pretende eliminar esta linha permanentemente do registo?')) {
      try {
        await ordersService.deleteOrder(orderId);
        toast.success('Registo eliminado com sucesso');
      } catch (error) {
        console.error('Erro ao eliminar:', error);
        toast.error('Erro ao eliminar o registo');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-primary-800">Administração - Facturação 10%</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => exportToCSV(true)}
            className="flex items-center space-x-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-md hover:bg-primary-200 transition text-sm font-medium"
          >
            <Download className="h-4 w-4" />
            <span>Resumo Semanal (CSV)</span>
          </button>
          <button
            onClick={() => exportToCSV(false)}
            className="flex items-center space-x-2 bg-primary-700 text-white px-4 py-2 rounded-md hover:bg-primary-800 transition text-sm font-medium"
          >
            <FileText className="h-4 w-4" />
            <span>Histórico Total (CSV)</span>
          </button>
        </div>
      </div>

      {/* Cartões Financeiros (Histórico Total) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Faturação Total Acumulada"
          value={`${stats.total_gross_revenue.toFixed(2)}€`}
          icon={<DollarSign className="h-6 w-6" />}
          color="bg-primary-600"
          subtitle="Valor total pago pelos clientes"
        />
        <StatCard
          title="Minha Comissão (10%)"
          value={`${stats.total_commission.toFixed(2)}€`}
          icon={<TrendingUp className="h-6 w-6" />}
          color="bg-green-600"
          subtitle="Montante total a faturar à Cave"
        />
        <StatCard
          title="Parte da Cave (90%)"
          value={`${stats.total_cave_share.toFixed(2)}€`}
          icon={<ShoppingBag className="h-6 w-6" />}
          color="bg-blue-600"
          subtitle="Receitas líquidas estimadas p/ Cave"
        />
      </div>

      {/* Resumo de Facturação por Semana */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-primary-800 flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent-500" />
            Resumo de Facturação por Semana
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-primary-50 text-primary-700 font-semibold">
              <tr>
                <th className="p-4">Semana (ISO)</th>
                <th className="p-4">Nº Encomendas</th>
                <th className="p-4">Valor Total (€)</th>
                <th className="p-4 bg-green-50 text-green-800">Comissão a Faturar (10%)</th>
                <th className="p-4 text-primary-500 italic">Parte Cave (90%)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {weeklyStats.map((w) => (
                <tr key={w.week} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-bold">{w.week}</td>
                  <td className="p-4">{w.count}</td>
                  <td className="p-4">{w.gross.toFixed(2)}€</td>
                  <td className="p-4 bg-green-50 font-bold text-green-700">{w.commission.toFixed(2)}€</td>
                  <td className="p-4 text-gray-400">{(w.gross * 0.9).toFixed(2)}€</td>
                </tr>
              ))}
              {weeklyStats.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">A processar dados...</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LISTA DETALHADA POUR COMPROVATIVOS */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-primary-800">Registo Histórico de Encomendas (Justificativos)</h2>
            <p className="text-sm text-primary-600 mt-1">Exibindo todas as encomendas, incluindo as ocultadas pela wineria.</p>
          </div>
          <button
            onClick={() => exportToCSV(false)}
            className="flex items-center space-x-2 bg-green-50 text-green-700 px-4 py-2 rounded-md hover:bg-green-100 transition text-sm font-bold border border-green-200"
          >
            <Download className="h-4 w-4" />
            <span>Baixar Registo Detalhado (CSV)</span>
          </button>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="p-3">Nº</th>
                <th className="p-3">Data</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Total (€)</th>
                <th className="p-3 text-right text-green-600">Com. 10% (€)</th>
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[13px]">
              {orders
                .filter(o => !o.admin_hidden) // Filtra encomendas ocultadas pelo administrador
                .map((o) => (
                <tr key={o.id} className={`hover:bg-gray-50 group ${o.cave_hidden ? 'bg-red-50/30' : ''}`}>
                  <td className="p-3">#{o.order_number}</td>
                  <td className="p-3">{new Date(o.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3 truncate max-w-[150px]">{o.user.full_name}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${o.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-primary-100 text-primary-700'}`}>
                      {(STATUS_LABELS as any)[o.status] || o.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-medium">{o.total.toFixed(2)}€</td>
                  <td className="p-3 text-right text-green-600 font-bold">{((o.total || 0) * 0.10).toFixed(2)}€</td>
                  <td className="p-2 text-center">
                    <button
                      onClick={() => handleHideOrder(o.id.toString())}
                      className="text-red-400 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remover apenas do meu registo de facturação"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuração de Segurança */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
          <Key className="h-5 w-5 mr-2" />
          Senha de Eliminação de Encomendas
        </h2>
        {message && (
          <div className={`mb-4 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 border border-green-400 text-green-700' : 'bg-red-100 border border-red-400 text-red-700'}`}>
            {message.text}
          </div>
        )}
        <form onSubmit={handleSavePassword} className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-primary-700 mb-2">Senha para Eliminar Todas as Encomendas</label>
            <input type="text" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500" placeholder="Ex: 1234" required />
            <p className="text-xs text-primary-500 mt-1">Esta senha será necessária para eliminar todas as encomendas no painel de gestão da wineria.</p>
          </div>
          <button type="submit" disabled={isSaving} className="flex items-center space-x-2 bg-accent-500 text-white px-6 py-2 rounded-md hover:bg-accent-600 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
            <Save className="h-5 w-5" />
            <span>{isSaving ? 'A gravar...' : 'Guardar'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-4">
        <div className={`${color} p-3 rounded-full text-white`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-primary-600">{title}</p>
          <p className="text-2xl font-bold text-primary-800">{value}</p>
          {subtitle && <p className="text-[10px] text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}