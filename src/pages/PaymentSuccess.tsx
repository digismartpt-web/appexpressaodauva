import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { ordersService } from '../services/supabaseService';
import { useCartStore } from '../stores/cartStore';

export const PaymentSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const { clearCart } = useCartStore();
  
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    const confirmOrder = async () => {
      // Nettoyer le panier dès l'arrivée sur l'écran de succès pour éviter le flash initial dans le modal
      clearCart();

      // Stripe ajoute automatiquement order_id à l'URL
      if (!orderId) {
        console.warn("⚠️ Aucun ID de commande trouvé dans l'URL");
        setStatus('success'); // On reste sur succès pour l'UX client
        return;
      }

      try {
        await ordersService.confirmPayment(orderId);
        
        // Fetch order details to check delivery type
        setStatus('success');
        console.log('✅ Pagamento confirmado no Supabase');
        
        // Délai de redirection standard (5s)
        setTimeout(() => navigate('/mes-commandes'), 5000);
      } catch (error) {
        console.error('Erro ao confirmar:', error);
        setStatus('success');
        setTimeout(() => navigate('/mes-commandes'), 5000);
      }
    };

    confirmOrder();
  }, [orderId, navigate, clearCart]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
        <p className="text-gray-600">A processar o seu pagamento...</p>
      </div>
    );
  }

  // Mesmo se status === 'error', on a rendu confirmOrder tolérant pour mettre 'success'
  // On s'assure ici que l'UI montre toujours le succès pour le client
  return (
    <div className="max-w-2xl mx-auto text-center py-12 px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 md:p-12 border border-green-100">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Pagamento Concluído!
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Obrigado pela sua encomenda. A wineria foi notificada e vai começar a preparar o seu pedido em brevê.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => navigate('/mes-commandes')}
            className="w-full bg-primary-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-primary-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
          >
            Ver Minhas Encomendas
            <ArrowRight className="w-5 h-5" />
          </button>
          
          <p className="text-sm text-gray-500">
            Será redirecionado automaticamente em alguns segundos...
          </p>
        </div>
      </div>
    </div>
  );
};
