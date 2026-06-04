import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Eye, EyeOff, Settings } from 'lucide-react';
import { winesService, extrasService } from '../../services/supabaseService';
import { useWinesStore } from '../../stores/winesStore';
import { useCaveCategories } from '../../hooks/useCaveCategories';
import type { Wine, Extra } from '../../types';

interface WineFormData {
  name: string;
  description: string;
  image_url: string;
  prices: {
    small: number;
    medium: number;
    large: number;
  };
  unique_price?: number;
  has_unique_price: boolean;
  ingredients: string[];
  category: string;
  vegetarian: boolean;
  active: boolean;
  customizable: boolean;
  max_custom_ingredients: number;
  custom_ingredients: string[];
}

interface ExtraFormData {
  name: string;
  price: number;
  active: boolean;
}

const initialFormData: WineFormData = {
  name: '',
  description: '',
  image_url: '',
  prices: {
    small: 0,
    medium: 0,
    large: 0
  },
  unique_price: undefined,
  has_unique_price: false,
  ingredients: [],
  category: '',
  vegetarian: false,
  active: true,
  customizable: false,
  max_custom_ingredients: 3,
  custom_ingredients: []
};

export function CaveMenu() {
  const { allWines: wines, allExtras: extras, loading, reloadWines, reloadExtras } = useWinesStore();
  const { activeCategories } = useCaveCategories();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const winesPerPage = 8;
  const [showModal, setShowModal] = useState(false);
  const [editingWine, setEditingWine] = useState<Wine | null>(null);
  const [formData, setFormData] = useState<WineFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [showExtraFormModal, setShowExtraFormModal] = useState(false);
  const [editingExtra, setEditingExtra] = useState<Extra | null>(null);
  const [extraFormData, setExtraFormData] = useState<ExtraFormData>({ name: '', price: 0, active: true });

  // Helper functions for 10% markup (apply to wines only)
  const applyMarkup = (price: number) => Math.round(price * 1.1 * 100) / 100;
  const removeMarkup = (price: number) => Math.round((price / 1.1) * 100) / 100;

  // Ouvir as mudanças de categorias
  useEffect(() => {
    const handleCategoriesUpdate = () => {
      // Forçar o re-render quando as categorias mudam
      setFormData(prev => ({ ...prev }));
    };

    window.addEventListener('categoriesUpdated', handleCategoriesUpdate);
    return () => window.removeEventListener('categoriesUpdated', handleCategoriesUpdate);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    console.log('🍕 Início da submissão do formulário');
    console.log('📝 Dados do formulário:', formData);

    // Verificar se pelo menos um preço está definido (preço único ou um tamanho)
    const hasUniquePrice = formData.has_unique_price && formData.unique_price && formData.unique_price > 0;
    const hasSizePrice = (!formData.has_unique_price) && (
      (formData.prices.small > 0) ||
      (formData.prices.medium > 0) ||
      (formData.prices.large > 0)
    );

    console.log('💰 Validação dos preços:', { hasUniquePrice, hasSizePrice, prices: formData.prices });

    if (!hasUniquePrice && !hasSizePrice) {
      console.log('❌ Falha na validação: nenhum preço definido');
      alert('⚠️ Atenção: Deve definir pelo menos um preço (preço único ou pelo menos um tamanho).');
      setIsSaving(false);
      return;
    }

    console.log('✅ Validação OK, gravação em curso...');

    // Aplicar a margem de 10% apenas para as wines
    const markedUpFormData: any = {
      ...formData,
      unique_price: formData.unique_price !== undefined ? applyMarkup(formData.unique_price) : undefined,
    };

    // Se tiver preço único, limpamos os preços individuais para evitar conflitos no backend
    if (formData.has_unique_price) {
      markedUpFormData.prices = {
        small: 0,
        medium: formData.unique_price ? applyMarkup(formData.unique_price) : 0,
        large: 0
      };
    } else {
      markedUpFormData.prices = {
        small: formData.prices.small ? applyMarkup(formData.prices.small) : 0,
        medium: formData.prices.medium ? applyMarkup(formData.prices.medium) : 0,
        large: formData.prices.large ? applyMarkup(formData.prices.large) : 0,
      };
    }

    try {
      console.log('💾 A gravar wine no Supabase...');
      if (editingWine) {
        console.log('📝 Modificando a wine:', editingWine.id);
        await winesService.updateWine(editingWine.id, markedUpFormData);
      } else {
        console.log('➕ Criando nova wine');
        const newId = await winesService.createWine(markedUpFormData);
        console.log('✅ Wine criada com ID:', newId);
      }
      await reloadWines();

      console.log('✅ Gravação concluída com sucesso, a fechar o modal');
      setShowModal(false);
      setEditingWine(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('❌ Erro ao guardar:', error);
      alert('Erro ao guardar a wine: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
      console.log('🏁 Fim da submissão');
    }
  };

  const handleEdit = (wine: Wine) => {
    setEditingWine(wine);
    setFormData({
      name: wine.name || '',
      description: wine.description || '',
      image_url: wine.image_url || '',
      prices: {
        small: wine.prices.small ? removeMarkup(wine.prices.small) : 0,
        medium: wine.prices.medium ? removeMarkup(wine.prices.medium) : 0,
        large: wine.prices.large ? removeMarkup(wine.prices.large) : 0,
      },
      has_unique_price: wine.has_unique_price || false,
      unique_price: wine.unique_price ? removeMarkup(wine.unique_price) : undefined,
      ingredients: wine.ingredients || [],
      category: wine.category || 'Outros',
      vegetarian: wine.vegetarian || false,
      active: true,
      customizable: wine.customizable || false,
      max_custom_ingredients: wine.max_custom_ingredients || 3,
      custom_ingredients: wine.custom_ingredients || []
    });
    setShowModal(true);
  };

  const handleDelete = async (wine: Wine) => {
    if (!confirm(`Tem a certeza que deseja eliminar "${wine.name}"?`)) {
      return;
    }
    try {
      await winesService.deleteWine(wine.id);
      await reloadWines();
    } catch (error) {
      console.error('Erro ao apagar:', error);
      alert('Erro ao eliminar a wine');
    }
  };

  const handleToggleActive = async (wine: Wine) => {
    try {
      const currentActiveState = (wine as any).active ?? true;
      const newActiveState = !currentActiveState;
      await winesService.updateWine(wine.id, { active: newActiveState });
      await reloadWines();
    } catch (error) {
      console.error('Erro na atualização:', error);
      alert('Erro ao atualizar a wine');
    }
  };

  const handleExtraSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const markedUpExtraData = {
      ...extraFormData,
      price: applyMarkup(extraFormData.price)
    };

    try {
      if (editingExtra) {
        await extrasService.updateExtra(editingExtra.id, markedUpExtraData);
      } else {
        await extrasService.createExtra(markedUpExtraData);
      }
      await reloadExtras();
      setShowExtraFormModal(false);
      setEditingExtra(null);
      setExtraFormData({ name: '', price: 0, active: true });
    } catch (error) {
      console.error('Erro ao guardar o extra:', error);
      alert('Erro ao guardar o extra');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditExtra = (extra: Extra) => {
    setEditingExtra(extra);
    setExtraFormData({
      name: extra.name,
      price: removeMarkup(extra.price),
      active: (extra as any).active !== false
    });
    setShowExtraFormModal(true);
  };

  const handleToggleExtraActive = async (extra: Extra) => {
    try {
      const newActiveState = !((extra as any).active !== false);
      await extrasService.updateExtra(extra.id, { active: newActiveState });
      await reloadExtras();
    } catch (error) {
      console.error('Erro ao mudar o estado do extra:', error);
      alert('Erro ao alterar o estado do extra');
    }
  };

  const handleDeleteExtra = async (extra: Extra) => {
    if (!confirm(`Tem a certeza que deseja eliminar "${extra.name}"?`)) {
      return;
    }
    try {
      await extrasService.deleteExtra(extra.id);
      await reloadExtras();
    } catch (error) {
      console.error('Erro ao apagar o extra:', error);
      alert('Erro ao eliminar o extra');
    }
  };

  // Filtrar e ordenar as wines
  const filteredAndSortedWines = [...wines]
    .filter(wine => {
      if (selectedCategory === 'all') return true;
      const wineCategory = wine.category || 'Outros';
      return wineCategory.toLowerCase() === selectedCategory.toLowerCase();
    })
    .sort((a, b) => {
      // Primeiro por categoria
      const categoryCompare = (a.category || '').localeCompare(b.category || '');
      if (categoryCompare !== 0) return categoryCompare;
      // Depois por nome alfabético
      return (a.name || '').localeCompare(b.name || '');
    });

  // Calcular as wines para a página atual
  const indexOfLastWine = currentPage * winesPerPage;
  const indexOfFirstWine = indexOfLastWine - winesPerPage;
  const currentWines = filteredAndSortedWines.slice(indexOfFirstWine, indexOfLastWine);
  const totalPages = Math.ceil(filteredAndSortedWines.length / winesPerPage);

  // Repor para a página 1 apenas quando o filtro muda e fazer scroll para cima
  useEffect(() => {
    setCurrentPage(1);
    window.scrollTo(0, 0);
  }, [selectedCategory]);

  // Fazer scroll para cima quando a página muda
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentPage]);

  // Obter as categorias disponíveis
  const availableCategories = activeCategories.length > 0
    ? activeCategories.map(cat => cat.name)
    : [...new Set(wines.map(wine => wine.category || 'Outros'))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-800 mx-auto mb-4"></div>
          <p className="text-primary-600">A carregar o menu de wines...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-h-full">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary-800 mb-2">Gestão do Menu</h1>
            <p className="text-primary-600">Adicione, modifique e gira</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowExtrasModal(true)}
              className="flex items-center space-x-2 bg-purple-500 text-white px-4 py-2 rounded-md hover:bg-purple-600 transition"
            >
              <Settings className="h-5 w-5" />
              <span>Gerir Extras</span>
            </button>
            <button
              onClick={() => {
                setEditingWine(null);
                setFormData(initialFormData);
                setShowModal(true);
              }}
              className="flex items-center space-x-2 bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
            >
              <Plus className="h-5 w-5" />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <label className="text-sm font-medium text-primary-700 flex-shrink-0">
            Filtrar por categoria:
          </label>
          <div className="flex flex-wrap gap-2 flex-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedCategory === 'all'
                ? 'bg-accent-500 text-white'
                : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                }`}
            >
              Todas ({wines.length})
            </button>
            {availableCategories.map((category) => {
              const count = wines.filter(p => p.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition ${selectedCategory === category
                    ? 'bg-accent-500 text-white'
                    : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                >
                  {category} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Total</h3>
          <p className="text-2xl font-bold text-accent-600">{filteredAndSortedWines.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Ativas</h3>
          <p className="text-2xl font-bold text-green-600">
            {filteredAndSortedWines.filter(p => (p as any).active !== false).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Vegetarianas</h3>
          <p className="text-2xl font-bold text-purple-600">
            {filteredAndSortedWines.filter(p => p.vegetarian).length}
          </p>
        </div>
      </div>

      {/* Lista de wines */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {filteredAndSortedWines.length > winesPerPage && (
          <div className="px-6 py-4 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Mostrando {indexOfFirstWine + 1} a {Math.min(indexOfLastWine, filteredAndSortedWines.length)} de {filteredAndSortedWines.length} wines
              </p>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Wine</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Categoria</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Preço</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {currentWines.map((wine, index) => {
                // Verificar se é a primeira wine de uma nova categoria
                const isFirstInCategory = index === 0 ||
                  currentWines[index - 1].category !== wine.category;

                return (
                  <tr key={wine.id} className={`hover:bg-primary-50 ${isFirstInCategory ? 'border-t-2 border-accent-200' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={wine.image_url}
                          alt={wine.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <div className="text-sm font-medium text-primary-800">{wine.name}</div>
                          <div className="text-sm text-primary-600 max-w-xs truncate">
                            {wine.description}
                          </div>
                          {wine.vegetarian && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Vegetariana
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-600 capitalize">
                      {wine.category}
                    </td>
                    <td className="px-6 py-4 text-sm text-primary-600">
                      {wine.has_unique_price ? (
                        <div>
                          <span className="font-medium">Preço Único: </span>
                          {(wine.unique_price || 0).toFixed(2)}€
                        </div>
                      ) : (
                        <>
                          <div>P: {(wine.prices.small || 0).toFixed(2)}€</div>
                          <div>M: {(wine.prices.medium || 0).toFixed(2)}€</div>
                          <div>G: {(wine.prices.large || 0).toFixed(2)}€</div>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(wine as any).active !== false
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                        }`}>
                        {(wine as any).active !== false ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleToggleActive(wine)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title={(wine as any).active !== false ? 'Desativar' : 'Ativar'}
                        >
                          {(wine as any).active !== false ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(wine)}
                          className="text-accent-600 hover:text-accent-800 p-1"
                          title="Modificar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(wine)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAndSortedWines.length > winesPerPage && (
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Anterior
              </button>

              {/* Números de páginas */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNumber) => (
                <button
                  key={pageNumber}
                  onClick={() => setCurrentPage(pageNumber)}
                  className={`px-3 py-2 text-sm rounded-md ${currentPage === pageNumber
                    ? 'bg-accent-500 text-white'
                    : 'border border-gray-300 hover:bg-gray-100'
                    }`}
                >
                  {pageNumber}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>

      {
        filteredAndSortedWines.length === 0 && wines.length > 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-primary-600 mb-4">Nenhuma wine nesta categoria</p>
            <button
              onClick={() => setSelectedCategory('all')}
              className="bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
            >
              Ver todas
            </button>
          </div>
        )
      }

      {
        wines.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-primary-600 mb-4">Nenhuma item no menu</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
            >
              Adicionar
            </button>
          </div>
        )
      }


      {/* Modal de gestão de extras */}
      {
        showExtrasModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-primary-800">Gestão de Extras</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setEditingExtra(null);
                        setEditingExtra(null);
                        setExtraFormData({ name: '', price: 0, active: true });
                        setShowExtraFormModal(true);
                      }}
                      className="flex items-center space-x-2 bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
                    >
                      <Plus className="h-5 w-5" />
                      <span>Adicionar Extra</span>
                    </button>
                    <button
                      onClick={() => setShowExtrasModal(false)}
                      className="px-4 py-2 text-primary-600 hover:text-primary-800"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                {extras.length === 0 ? (
                  <div className="text-center py-12">
                    <Settings className="h-16 w-16 text-primary-300 mx-auto mb-4" />
                    <p className="text-primary-600 mb-4">Nenhum extra configurado</p>
                    <button
                      onClick={() => {
                        setEditingExtra(null);
                        setEditingExtra(null);
                        setExtraFormData({ name: '', price: 0, active: true });
                        setShowExtraFormModal(true);
                      }}
                      className="bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
                    >
                      Criar o seu primeiro extra
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-primary-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Nome</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Preço</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Estado</th>
                          <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-primary-100">
                        {extras.map((extra) => (
                          <tr key={extra.id} className="hover:bg-primary-50">
                            <td className="px-6 py-4 text-sm font-medium text-primary-800">
                              {extra.name}
                            </td>
                            <td className="px-6 py-4 text-sm text-primary-600">
                              {(extra.price || 0).toFixed(2)}€
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(extra as any).active !== false
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                                }`}>
                                {(extra as any).active !== false ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleToggleExtraActive(extra)}
                                  className="text-blue-600 hover:text-blue-800 p-1"
                                  title={(extra as any).active !== false ? 'Desativar' : 'Ativar'}
                                >
                                  {(extra as any).active !== false ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleEditExtra(extra)}
                                  className="text-accent-600 hover:text-accent-800 p-1"
                                  title="Modificar"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteExtra(extra)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Modal de formulaire extra */}
      {
        showExtraFormModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <form onSubmit={handleExtraSubmit} className="p-6 space-y-6">
                <h2 className="text-2xl font-bold text-primary-800">
                  {editingExtra ? 'Modificar Extra' : 'Adicionar Extra'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Nome do Extra
                    </label>
                    <input
                      type="text"
                      value={extraFormData.name}
                      onChange={(e) => setExtraFormData({ ...extraFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      placeholder="Ex: Mozzarella extra"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Preço (€)
                    </label>
                    <input
                      type="number"
                      id="extra-price"
                      name="extra-price"
                      value={extraFormData.price}
                      onChange={(e) => setExtraFormData({ ...extraFormData, price: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="0.00"
                      title="Preço do extra em euros"
                    />
                    {extraFormData.price > 0 && (
                      <p className="text-xs text-green-600 mt-1 font-medium italic">
                        Final (+10%): {applyMarkup(extraFormData.price).toFixed(2)}€
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExtraFormModal(false);
                      setEditingExtra(null);
                      setExtraFormData({ name: '', price: 0, active: true });
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-primary-600 hover:text-primary-800 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 disabled:opacity-50"
                  >
                    {isSaving ? 'A guardar...' : (editingExtra ? 'Modificar' : 'Adicionar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
      {/* Modal d'ajout/modification */}
      {
        showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <h2 className="text-2xl font-bold text-primary-800">
                  {editingWine ? 'Modificar' : 'Adicionar'}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Nome
                    </label>
                    <input
                      type="text"
                      id="wine-name"
                      name="wine-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      required
                      placeholder="Nome do produto"
                      title="Nome do produto"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Descrição
                    </label>
                    <textarea
                      id="wine-description"
                      name="wine-description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      rows={3}
                      placeholder="Descrição dos ingredientes, etc."
                      title="Descrição do produto"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      URL da Imagem
                    </label>
                    <input
                      type="url"
                      id="wine-image-url"
                      name="wine-image-url"
                      value={formData.image_url}
                      onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      required
                      placeholder="https://exemplo.com/imagem.jpg"
                      title="URL da imagem do produto"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="has_unique_price"
                      checked={formData.has_unique_price}
                      onChange={(e) => setFormData({
                        ...formData,
                        has_unique_price: e.target.checked,
                        unique_price: e.target.checked ? 0 : undefined,
                        prices: e.target.checked ? { small: 0, medium: 0, large: 0 } : formData.prices
                      })}
                      className="rounded border-primary-300 text-accent-500 focus:ring-accent-500"
                    />
                    <label htmlFor="has_unique_price" className="text-sm font-medium text-primary-700">
                      Este item tem um preço único
                    </label>
                  </div>

                  {formData.has_unique_price ? (
                    <div>
                      <label className="block text-sm font-medium text-primary-700 mb-1">
                        Preço Único (€)
                      </label>
                      <input
                        type="number"
                        id="unique_price"
                        name="unique_price"
                        value={formData.unique_price || ''}
                        onChange={(e) => setFormData({
                          ...formData,
                          unique_price: Number(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                        min="0.01"
                        step="0.01"
                        required
                        title="Preço único em euros"
                      />
                      {formData.unique_price !== undefined && formData.unique_price > 0 && (
                        <p className="text-xs text-green-600 mt-1 font-medium italic">
                          Preço Final (com +10%): {applyMarkup(formData.unique_price || 0).toFixed(2)}€
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-primary-600 mb-3">
                        💡 Defina pelo menos um preço
                      </p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-primary-700 mb-1">
                            Preço (Pequena)
                          </label>
                          <input
                            type="number"
                            id="price-small"
                            name="price-small"
                            value={formData.prices.small || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              prices: { ...formData.prices, small: Number(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                            min="0"
                            step="0.01"
                            placeholder="0 = não disponível"
                            title="Preço para tamanho pequeno"
                          />
                          {formData.prices.small > 0 && (
                            <p className="text-[10px] text-green-600 mt-1 font-medium italic">
                              Final (+10%): {applyMarkup(formData.prices.small).toFixed(2)}€
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-primary-700 mb-1">
                            Preço (Média)
                          </label>
                          <input
                            type="number"
                            id="price-medium"
                            name="price-medium"
                            value={formData.prices.medium || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              prices: { ...formData.prices, medium: Number(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                            min="0"
                            step="0.01"
                            placeholder="0 = não disponible"
                            title="Preço para tamanho médio"
                          />
                          {formData.prices.medium > 0 && (
                            <p className="text-[10px] text-green-600 mt-1 font-medium italic">
                              Final (+10%): {applyMarkup(formData.prices.medium).toFixed(2)}€
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-primary-700 mb-1">
                            Preço (Grande)
                          </label>
                          <input
                            type="number"
                            id="price-large"
                            name="price-large"
                            value={formData.prices.large || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              prices: { ...formData.prices, large: Number(e.target.value) || 0 }
                            })}
                            className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                            min="0"
                            step="0.01"
                            placeholder="0 = não disponible"
                            title="Preço para tamanho grande"
                          />
                          {formData.prices.large > 0 && (
                            <p className="text-[10px] text-green-600 mt-1 font-medium italic">
                              Final (+10%): {applyMarkup(formData.prices.large).toFixed(2)}€
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Ingredientes
                    </label>
                    <div className="space-y-3">
                      {/* Lista de ingredientes atuais */}
                      {(formData.ingredients || []).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {(formData.ingredients || []).map((ingredient, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-accent-100 text-accent-800"
                            >
                              {ingredient}
                              <button
                                type="button"
                                onClick={() => {
                                  const newIngredients = (formData.ingredients || []).filter((_, i) => i !== index);
                                  setFormData({ ...formData, ingredients: newIngredients });
                                }}
                                className="ml-2 text-accent-600 hover:text-accent-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-primary-500 italic">Nenhum ingrediente adicionado.</p>
                      )}

                      {/* Campo para adicionar um novo ingrediente */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="newIngredient"
                          placeholder="Adicionar ingrediente..."
                          className="flex-1 px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const input = e.target as HTMLInputElement;
                              const newIngredient = input.value.trim();
                              if (newIngredient && !(formData.ingredients || []).includes(newIngredient)) {
                                setFormData({
                                  ...formData,
                                  ingredients: [...(formData.ingredients || []), newIngredient]
                                });
                                input.value = '';
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('newIngredient') as HTMLInputElement;
                            const newIngredient = input.value.trim();
                            if (newIngredient && !(formData.ingredients || []).includes(newIngredient)) {
                              setFormData({
                                ...formData,
                                ingredients: [...(formData.ingredients || []), newIngredient]
                              });
                              input.value = '';
                            }
                          }}
                          className="px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 transition"
                        >
                          Adicionar
                        </button>
                      </div>

                      <p className="text-xs text-primary-500">
                        Digite um ingrediente e clique "Adicionar" ou pressione Enter
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-primary-700 mb-1">
                      Categoria
                    </label>
                    <select
                      id="wine-category-select"
                      name="wine-category-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                      required
                      title="Selecione a categoria"
                    >
                      <option value="">Selecionar categoria</option>
                      {activeCategories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="border-t border-primary-200 pt-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <input
                        type="checkbox"
                        id="customizable"
                        checked={formData.customizable}
                        onChange={(e) => setFormData({
                          ...formData,
                          customizable: e.target.checked
                        })}
                        className="rounded border-primary-300 text-accent-500 focus:ring-accent-500"
                      />
                      <label htmlFor="customizable" className="text-sm font-medium text-primary-700">
                        Personalizável (clientes podem adicionar ingredientes)
                      </label>
                    </div>

                    {formData.customizable && (
                      <div className="space-y-4 pl-6 border-l-2 border-accent-200">
                        <div>
                          <label className="block text-sm font-medium text-primary-700 mb-1">
                            Número máximo de ingredientes (1-10)
                          </label>
                          <input
                            type="number"
                            id="max-custom-ingredients"
                            name="max-custom-ingredients"
                            value={formData.max_custom_ingredients}
                            onChange={(e) => setFormData({
                              ...formData,
                              max_custom_ingredients: Math.min(10, Math.max(1, Number(e.target.value)))
                            })}
                            className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                            min="1"
                            max="10"
                            required
                            title="Número máximo de ingredientes permitidos"
                            placeholder="3"
                          />
                          <p className="text-xs text-primary-500 mt-1">
                            Clientes poderão escolher até {formData.max_custom_ingredients} ingrediente(s)
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-primary-700 mb-1">
                            Ingredientes disponíveis para personalização
                          </label>
                          <div className="space-y-3">
                            {(formData.custom_ingredients || []).length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {(formData.custom_ingredients || []).map((ingredient, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                                  >
                                    {ingredient}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newIngredients = (formData.custom_ingredients || []).filter((_, i) => i !== index);
                                        setFormData({ ...formData, custom_ingredients: newIngredients });
                                      }}
                                      className="ml-2 text-green-600 hover:text-green-800"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-primary-500 italic">Nenhum ingrediente personalizável adicionado.</p>
                            )}

                            <div className="flex gap-2">
                              <input
                                type="text"
                                id="newCustomIngredient"
                                placeholder="Ex: Cogumelos, Azeitonas..."
                                className="flex-1 px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const input = e.target as HTMLInputElement;
                                    const newIngredient = input.value.trim();
                                    if (newIngredient && !formData.custom_ingredients.includes(newIngredient)) {
                                      setFormData({
                                        ...formData,
                                        custom_ingredients: [...formData.custom_ingredients, newIngredient]
                                      });
                                      input.value = '';
                                    }
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const input = document.getElementById('newCustomIngredient') as HTMLInputElement;
                                  const newIngredient = input.value.trim();
                                  if (newIngredient && !formData.custom_ingredients.includes(newIngredient)) {
                                    setFormData({
                                      ...formData,
                                      custom_ingredients: [...formData.custom_ingredients, newIngredient]
                                    });
                                    input.value = '';
                                  }
                                }}
                                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition"
                              >
                                Adicionar
                              </button>
                            </div>

                            <p className="text-xs text-primary-500">
                              Estes ingredientes estarão disponíveis para os clientes escolherem ao personalizar
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditingWine(null);
                      setFormData(initialFormData);
                    }}
                    disabled={isSaving}
                    className="px-4 py-2 text-primary-600 hover:text-primary-800 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-4 py-2 bg-accent-500 text-white rounded-md hover:bg-accent-600 disabled:opacity-50"
                  >
                    {isSaving ? 'A guardar...' : (editingWine ? 'Modificar' : 'Adicionar')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}