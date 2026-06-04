import { useState, useEffect } from 'react';
import { Filter, Wine as WineIcon } from 'lucide-react';
import { BrandingFooter } from '../components/BrandingFooter';
import { WineModal } from '../components/WineModal';
import { useCartStore } from '../stores/cartStore';
import { useWinesStore } from '../stores/winesStore';
import { useCaveSettings } from '../hooks/useCaveSettings';
import { useAuth } from '../hooks/useAuth';
import type { Wine, Extra } from '../types';

export function Menu() {
  const { user } = useAuth();

  const { wines, loading: winesLoading, categories: activeCategories } = useWinesStore();
  const { settings } = useCaveSettings();
  const commission = settings.service_fee_percentage || 10;

  const [loading, setLoading] = useState(() => wines.length === 0);
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const winesPerPage = 9;
  const { addItem } = useCartStore();

  // Atualizar loading state quando store mudar
  useEffect(() => {
    if (!winesLoading) {
      setLoading(false);
    }
  }, [winesLoading]);

  // Fallback: forcer l'affichage apres 5s meme si le store charge pas
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Obter as categorias disponíveis (apenas as ativas)
  const getAvailableCategories = () => {
    if (activeCategories.length > 0) {
      // Filtrar apenas categorias ativas
      return activeCategories
        .filter(cat => cat.active !== false)
        .map(cat => cat.name.toLowerCase());
    } else {
      // Fallback: extrair as categorias das wines
      const categories = [...new Set(wines.map(wine => wine.category || 'Outros'))];
      return categories;
    }
  };

  const availableCategories = getAvailableCategories();

  // Filtrar e ordenar as wines
  const filteredWines = wines
    .filter(wine => {
      // 1. Filtrar se a categoria da wine está ativa
      const categoryName = (wine.category || 'Outros').toLowerCase();
      const isCategoryActive = activeCategories.length === 0 || 
        activeCategories.some(cat => cat.name.toLowerCase() === categoryName && cat.active !== false);
      
      if (!isCategoryActive) return false;

      // 2. Filtrar pela categoria selecionada
      if (selectedCategory === 'all') return true;
      return categoryName === selectedCategory.toLowerCase();
    })
    .sort((a, b) => {
      const catA = (a.category || 'Outros');
      const catB = (b.category || 'Outros');
      const categoryCompare = catA.localeCompare(catB);
      if (categoryCompare !== 0) return categoryCompare;
      return (a.name || '').localeCompare(b.name || '');
    });

  // Calcular as wines para a página atual
  const indexOfLastWine = currentPage * winesPerPage;
  const indexOfFirstWine = indexOfLastWine - winesPerPage;
  const currentWines = filteredWines.slice(indexOfFirstWine, indexOfLastWine);
  const totalPages = Math.ceil(filteredWines.length / winesPerPage);

  // Repor para a página 1 quando os filtros mudam e fazer scroll para cima
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo(0, 0);
  }, [selectedCategory]);

  // Fazer scroll para cima quando a página muda
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  const handleAddToCart = (wine: Wine, size: 'small' | 'medium' | 'large', removedIngredients: string[], extras: Extra[], customIngredients: string[]) => {
    addItem({
      wine,
      size,
      quantity: 1,
      removedIngredients,
      extras,
      customIngredients,
      commission
    });
  };

  // Removed top-level loading check to allow Skeleton/Banner to show faster


  // Diagnostic Log for sync issues
  if (wines.length === 0 && !loading) {
    console.log('🔍 [Menu Diagnostic]');
    console.log('- User UID:', user?.id || 'null');
    console.log('- Is Anonymous:', user?.email === '' ? 'Yes' : 'No');
    console.log('- Wine total:', wines.length);
    console.log('- Filtered wines:', filteredWines.length);
  }

  return (
    <div className="min-h-screen bg-primary-50">
      <div className="container mx-auto px-4 py-8">

        {loading && wines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-600 mb-4"></div>
            <p className="text-primary-600 font-medium">A carregar o nosso menu...</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-700">
            {/* Banner Promocional - Now synchronized with wines */}
            {settings.banner_active && settings.banner_image_url && (
              <div className="mb-8 w-full max-w-5xl mx-auto rounded-xl overflow-hidden shadow-lg bg-white">
                <img
                  src={settings.banner_image_url}
                  alt="Promoção Especial"
                  className="w-full h-auto block"
                />
              </div>
            )}

            {/* Header com logo */}
            <div className="text-center mb-6 sm:mb-8">
              {settings.logo_url && (
                <div className="flex justify-center mb-4 sm:mb-6">
                  <img
                    src={settings.logo_url}
                    alt={settings.name}
                    className="h-16 sm:h-20 md:h-24 w-auto object-contain max-w-xs"
                    style={{ aspectRatio: 'auto' }}
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => {
                      console.error('Erro ao carregar logo do menu');
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary-800 mb-2 px-4">O Nosso Menu</h1>
              <div className="sm:hidden">
                <BrandingFooter isStatic={true} />
              </div>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Filtro por categoria */}
                <div className="relative w-full">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-primary-400 h-5 w-5" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Filtrar por categoria"
                    className="w-full pl-10 pr-8 py-3 text-base border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white touch-manipulation"
                  >
                    <option value="all">Todas as categorias</option>
                    {availableCategories.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botões de categoria - Ocultos em mobile, visibles em desktop */}
              <div className="hidden sm:flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition touch-manipulation ${selectedCategory === 'all'
                    ? 'bg-accent-500 text-white'
                    : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                >
                  Todas
                </button>
                {availableCategories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition touch-manipulation ${selectedCategory === category
                      ? 'bg-accent-500 text-white'
                      : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                      }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {filteredWines.length === 0 ? (
              <div className="text-center py-12">
                <WineIcon className="h-16 w-16 text-primary-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-primary-800 mb-2">
                  Nenhum produto encontrado
                </h3>
                <p className="text-primary-600">
                  Tente ajustar os seus filtros de pesquisa
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {currentWines.map((wine) => (
                    <div
                      key={wine.id}
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow cursor-pointer active:scale-98 touch-manipulation"
                      onClick={() => setSelectedWine(wine)}
                    >
                      <div className="w-full h-40 sm:h-48 bg-primary-100 flex items-center justify-center relative overflow-hidden">
                        {/* Fundo de reserva */}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-primary-100 animate-pulse"></div>
                        <img
                          src={wine.image_url}
                          alt={wine.name}
                          className="w-full h-full object-cover relative z-10 transition-opacity duration-300 opacity-0"
                          onLoad={(e) => {
                            (e.currentTarget as HTMLImageElement).classList.remove('opacity-0');
                            (e.currentTarget as HTMLImageElement).classList.add('opacity-100');
                            const placeholder = e.currentTarget.previousElementSibling;
                            if (placeholder) placeholder.remove();
                          }}
                          loading="eager"
                          fetchPriority="high"
                        />
                      </div>
                      <div className="p-4 sm:p-6">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-lg sm:text-xl font-semibold text-primary-800">{wine.name}</h3>
                          {wine.vegetarian && (
                            <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full ml-2 flex-shrink-0">
                              Vegetariana
                            </span>
                          )}
                        </div>
                        <p className="text-primary-600 text-sm mb-4 line-clamp-2">
                          {wine.description}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="text-sm text-primary-500">
                            {(() => {
                              // Se preço único, apresentá-lo
                              if (wine.unique_price !== undefined && wine.unique_price > 0) {
                                return (
                                  <span className="text-lg sm:text-xl font-bold text-accent-600">{wine.unique_price}€</span>
                                );
                              }

                              // Caso contrário, apresentar o preço mínimo dos tamanhos
                              const availablePrices = [];
                              if (wine.prices.small > 0) availablePrices.push(wine.prices.small);
                              if (wine.prices.medium > 0) availablePrices.push(wine.prices.medium);
                              if (wine.prices.large > 0) availablePrices.push(wine.prices.large);

                              if (availablePrices.length === 0) {
                                return <span className="text-gray-400">Preços em configuração</span>;
                              }

                              const minPrice = Math.min(...availablePrices);
                              return (
                                <>
                                  A partir de <span className="text-lg sm:text-xl font-bold text-accent-600">{minPrice}€</span>
                                </>
                              );
                            })()}
                          </div>
                          <button className="w-full sm:w-auto bg-accent-500 text-white px-4 py-2.5 rounded-md hover:bg-accent-600 active:bg-accent-700 transition text-sm sm:text-base font-medium touch-manipulation">
                            Personalizar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {filteredWines.length > winesPerPage && (
                  <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                      <p className="text-xs sm:text-sm text-primary-600 text-center sm:text-left">
                        A mostrar {indexOfFirstWine + 1} a {Math.min(indexOfLastWine, filteredWines.length)} de {filteredWines.length} produtos
                      </p>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 sm:px-4 py-2 text-sm border border-primary-300 rounded-md hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
                        >
                          ← Anterior
                        </button>

                        {/* Números de páginas - Oculto se houver demasiadas páginas no telemóvel */}
                        <div className="hidden sm:flex items-center space-x-2">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                            <button
                              key={pageNumber}
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`px-3 py-2 text-sm rounded-md transition touch-manipulation ${currentPage === pageNumber
                                ? 'bg-accent-500 text-white'
                                : 'border border-primary-300 hover:bg-primary-50'
                                }`}
                            >
                              {pageNumber}
                            </button>
                          ))}
                        </div>

                        {/* Indicateur page actuelle sur mobile */}
                        <div className="sm:hidden px-3 py-2 text-sm font-medium text-primary-700">
                          {currentPage} / {totalPages}
                        </div>

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="px-3 sm:px-4 py-2 text-sm border border-primary-300 rounded-md hover:bg-primary-50 disabled:opacity-50 disabled:cursor-not-allowed transition touch-manipulation"
                        >
                          Seguinte →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Modal de personalização */}
        <WineModal
          wine={selectedWine!}
          isOpen={!!selectedWine}
          onClose={() => setSelectedWine(null)}
          onAddToCart={handleAddToCart}
        />

        {/* Debug Panel removed for production feel */}

      </div>
    </div>
  );
}