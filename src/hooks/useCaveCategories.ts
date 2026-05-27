import { categoriesService } from '../services/supabaseService';
import { useWinesStore } from '../stores/winesStore';
import type { Category } from '../types';

export function useCaveCategories() {
  const { categories, loading } = useWinesStore();

  const addCategory = async (categoryData: Omit<Category, 'id' | 'created_at'>) => {
    try {
      const newCategoryId = await categoriesService.createCategory(categoryData);
      console.log('✅ Categoria criada com ID:', newCategoryId);
      // Fallback: force update store in case Realtime is slow/disabled
      const { categories: currentCats } = useWinesStore.getState();
      categoriesService.getAllCategories().then(cats => useWinesStore.setState({ categories: cats }));
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
      throw error;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    try {
      await categoriesService.updateCategory(id, categoryData);
      console.log('✅ Categoria atualizada');
      // Fallback refresh
      categoriesService.getAllCategories().then(cats => useWinesStore.setState({ categories: cats }));
    } catch (error) {
      console.error('Erro na atualização da categoria:', error);
      throw error;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await categoriesService.deleteCategory(id);
      console.log('✅ Categoria eliminada');
      // Fallback refresh
      categoriesService.getAllCategories().then(cats => useWinesStore.setState({ categories: cats }));
    } catch (error) {
      console.error('Erro ao apagar categoria:', error);
      throw error;
    }
  };

  const toggleActive = async (id: string) => {
    const category = categories.find((cat: Category) => cat.id === id);
    if (category) {
      await updateCategory(id, { active: !category.active });
    }
  };

  const getActiveCategories = () => {
    return categories.filter((cat: Category) => cat.active);
  };

  return {
    categories,
    activeCategories: getActiveCategories(),
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleActive
  };
}