import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWinesStore } from '../stores/winesStore';
import { useCaveSettings } from '../hooks/useCaveSettings';
import { Wine } from '../types';
import type { Extra } from '../types';

interface WineModalProps {
  wine: Wine;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (wine: Wine, size: 'small' | 'medium' | 'large', removedIngredients: string[], extras: Extra[], customIngredients: string[], commission?: number) => void;
}

export function WineModal({ wine, isOpen, onClose, onAddToCart }: WineModalProps) {
  const [selectedSize, setSelectedSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [removedIngredients, setRemovedIngredients] = useState<string[]>([]);
  const [selectedExtras, setSelectedExtras] = useState<Extra[]>([]);
  const [customIngredients, setCustomIngredients] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const { extras: availableExtras } = useWinesStore();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { settings } = useCaveSettings();
  const commission = settings.service_fee_percentage || 10;

  // Réinitialiser les personnalisations quand une nouvelle wine est sélectionnée
  useEffect(() => {
    if (isOpen && wine) {
      // Determinar o tamanho inicial baseado nos preços disponíveis
      let initialSize: 'small' | 'medium' | 'large' = 'medium';
      
      if (!wine.unique_price || wine.unique_price === 0) {
        if (wine.prices.medium > 0) {
          initialSize = 'medium';
        } else if (wine.prices.small > 0) {
          initialSize = 'small';
        } else if (wine.prices.large > 0) {
          initialSize = 'large';
        }
      }
      
      setSelectedSize(initialSize);
      setRemovedIngredients([]);
      setSelectedExtras([]);
      setCustomIngredients([]);
      setQuantity(1);
    }
  }, [isOpen, wine?.id]);

  // Extras são agora fornecidos via WinesStore global

  if (!isOpen) return null;

  const toggleIngredient = (ingredient: string) => {
    setRemovedIngredients(prev =>
      prev.includes(ingredient)
        ? prev.filter(i => i !== ingredient)
        : [...prev, ingredient]
    );
  };

  const toggleExtra = (extra: Extra) => {
    setSelectedExtras(prev =>
      prev.find(e => e.id === extra.id)
        ? prev.filter(e => e.id !== extra.id)
        : [...prev, extra]
    );
  };

  const calculateTotal = () => {
    let basePrice = 0;

    if (wine.unique_price && wine.unique_price > 0) {
      basePrice = wine.unique_price;
    } else {
      basePrice = wine.prices[selectedSize] || 0;
    }

    const extrasTotal = selectedExtras.reduce((sum, extra) => sum + extra.price, 0);
    return (basePrice + extrasTotal) * quantity;
  };

  const handleAddToCart = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    // Vérifier si la personnalisation est activée et le nombre max d'ingrédients
    if (wine.customizable && customIngredients.length > (wine.max_custom_ingredients || 3)) {
      alert(`Você pode escolher no máximo ${wine.max_custom_ingredients || 3} ingrediente(s) extra`);
      return;
    }

    // Ajouter chaque wine individuellement pour permettre des personnalisations différentes
    for (let i = 0; i < quantity; i++) {
      onAddToCart(wine, selectedSize, removedIngredients, selectedExtras, customIngredients, commission);
    }
    // Réinitialiser la quantité après ajout
    setQuantity(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-lg sm:rounded-lg w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b z-10 p-4 sm:p-6 flex justify-between items-center">
          <h2 className="text-xl sm:text-2xl font-bold pr-4">Personalizar {wine.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2 -m-2 touch-manipulation">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Quantidade</h3>
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-xl font-bold transition-colors touch-manipulation"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="text-2xl font-bold min-w-[3rem] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-xl font-bold transition-colors touch-manipulation"
              >
                +
              </button>
            </div>
          </div>

          {/* Affichage conditionnel des tailles */}
          {wine.unique_price !== undefined && wine.unique_price > 0 ? (
            <div className="bg-accent-50 p-4 rounded-lg text-center">
              <h3 className="text-lg font-medium mb-2">Preço Único</h3>
              <div className="text-2xl font-bold text-accent-600">{wine.unique_price.toFixed(2)}€</div>
              <p className="text-sm text-accent-700 mt-1">Tamanho único disponível</p>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-medium mb-4">Tamanho</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {wine.prices.small > 0 && (
                  <button
                    onClick={() => setSelectedSize('small')}
                    className={`p-3 rounded-lg text-center transition-colors ${selectedSize === 'small'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                      } touch-manipulation`}
                  >
                    <div className="text-sm sm:text-base">Pequena</div>
                    <div className="font-bold text-lg">{wine.prices.small.toFixed(2)}€</div>
                  </button>
                )}
                {wine.prices.medium > 0 && (
                  <button
                    onClick={() => setSelectedSize('medium')}
                    className={`p-3 rounded-lg text-center transition-colors ${selectedSize === 'medium'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                      } touch-manipulation`}
                  >
                    <div className="text-sm sm:text-base">Média</div>
                    <div className="font-bold text-lg">{wine.prices.medium.toFixed(2)}€</div>
                  </button>
                )}
                {wine.prices.large > 0 && (
                  <button
                    onClick={() => setSelectedSize('large')}
                    className={`p-3 rounded-lg text-center transition-colors ${selectedSize === 'large'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                      } touch-manipulation`}
                  >
                    <div className="text-sm sm:text-base">Grande</div>
                    <div className="font-bold text-lg">{wine.prices.large.toFixed(2)}€</div>
                  </button>
                )}
              </div>
            </>
          )}

          <div>
            <h3 className="text-lg font-medium mb-2">Ingredientes base</h3>
            <p className="text-sm text-gray-600 mb-4">Toque num ingrediente para o remover</p>
            <div className="flex flex-wrap gap-2">
              {wine.ingredients.map((ingredient) => (
                <button
                  key={ingredient}
                  onClick={() => toggleIngredient(ingredient)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${removedIngredients.includes(ingredient)
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300'
                    } touch-manipulation`}
                >
                  {ingredient}
                  {removedIngredients.includes(ingredient) && ' ✕'}
                </button>
              ))}
            </div>
          </div>

          {availableExtras.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-2">Extras</h3>
              <p className="text-sm text-gray-600 mb-3">
                Personalize a sua wine com ingredientes adicionais
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-3">
                  {availableExtras.slice(0, Math.ceil(availableExtras.length / 2)).map((extra) => (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${selectedExtras.find(e => e.id === extra.id)
                        ? 'bg-orange-50 border-2 border-orange-500'
                        : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                        } touch-manipulation`}
                    >
                      <span className="flex items-center text-sm sm:text-base">
                        {selectedExtras.find(e => e.id === extra.id) ? '−' : '+'} {extra.name}
                      </span>
                      <span className="font-medium text-sm sm:text-base">
                        {selectedExtras.find(e => e.id === extra.id) ? '−' : '+'}{extra.price.toFixed(2)}€
                      </span>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {availableExtras.slice(Math.ceil(availableExtras.length / 2)).map((extra) => (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${selectedExtras.find(e => e.id === extra.id)
                        ? 'bg-orange-50 border-2 border-orange-500'
                        : 'bg-gray-50 hover:bg-gray-100 active:bg-gray-200'
                        } touch-manipulation`}
                    >
                      <span className="flex items-center text-sm sm:text-base">
                        {selectedExtras.find(e => e.id === extra.id) ? '−' : '+'} {extra.name}
                      </span>
                      <span className="font-medium text-sm sm:text-base">
                        {selectedExtras.find(e => e.id === extra.id) ? '−' : '+'}{extra.price.toFixed(2)}€
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {wine.customizable && wine.custom_ingredients && wine.custom_ingredients.length > 0 && (
            <div className="border-t-2 border-green-200 pt-6">
              <h3 className="text-lg font-medium mb-2 text-green-700">Ingredientes Extra Personalizados</h3>
              <p className="text-sm text-gray-600 mb-3">
                Escolha até {wine.max_custom_ingredients || 3} ingrediente(s) extra ({customIngredients.length}/{wine.max_custom_ingredients || 3} selecionado(s))
              </p>
              <div className="flex flex-wrap gap-2">
                {wine.custom_ingredients.map((ingredient) => {
                  const isSelected = customIngredients.includes(ingredient);
                  const canSelect = customIngredients.length < (wine.max_custom_ingredients || 3);
                  const isDisabled = !isSelected && !canSelect;

                  return (
                    <button
                      key={ingredient}
                      onClick={() => {
                        if (isSelected) {
                          setCustomIngredients(customIngredients.filter(i => i !== ingredient));
                        } else if (canSelect) {
                          setCustomIngredients([...customIngredients, ingredient]);
                        }
                      }}
                      disabled={isDisabled}
                      className={`px-4 py-2 rounded-lg text-sm transition-colors touch-manipulation ${isSelected
                        ? 'bg-green-500 text-white border-2 border-green-600'
                        : isDisabled
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-green-50 text-green-800 hover:bg-green-100 active:bg-green-200 border-2 border-green-300'
                        }`}
                    >
                      {isSelected ? '✓ ' : '+ '}{ingredient}
                    </button>
                  );
                })}
              </div>
              {customIngredients.length >= (wine.max_custom_ingredients || 3) && (
                <p className="text-sm text-orange-600 mt-2">
                  Limite de {wine.max_custom_ingredients || 3} ingrediente(s) atingido. Desmarque um para escolher outro.
                </p>
              )}
            </div>
          )}

          <div className="sticky bottom-0 bg-white pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium">Total:</span>
              <span className="text-2xl font-bold text-orange-500">
                {calculateTotal().toFixed(2)}€
              </span>
            </div>
            <button
              onClick={handleAddToCart}
              className="w-full bg-orange-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-orange-600 active:bg-orange-700 transition-colors touch-manipulation"
            >
              Adicionar ao carrinho
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}