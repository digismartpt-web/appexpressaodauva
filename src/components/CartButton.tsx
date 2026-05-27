import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';

interface CartButtonProps {
  onClick?: () => void;
}

export const CartButton: React.FC<CartButtonProps> = ({ onClick }) => {
  const { items, getTotal } = useCartStore();
  
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = getTotal();

  return (
    <button
      onClick={onClick}
      className="relative flex items-center space-x-2 bg-accent-600 text-white px-3 sm:px-4 py-2 sm:py-2 rounded-lg hover:bg-accent-700 active:bg-accent-800 transition-colors cursor-pointer touch-manipulation text-sm sm:text-base"
    >
      <ShoppingCart className="w-5 h-5" />
      <span className="font-medium hidden sm:inline">
        {itemCount > 0 ? `${itemCount} • ${total.toFixed(2)}€` : 'Carrinho'}
      </span>
      <span className="font-medium sm:hidden">
        {itemCount > 0 ? `${itemCount}` : ''}
      </span>
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-secondary-500 text-white text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
          {itemCount}
        </span>
      )}
    </button>
  );
};