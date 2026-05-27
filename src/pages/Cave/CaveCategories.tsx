import { useState } from 'react';
import { Plus, Edit2, Trash2, Tag } from 'lucide-react';
import { useCaveCategories } from '../../hooks/useCaveCategories';

interface CategoryFormData {
  name: string;
  description: string;
  active: boolean;
}

const initialFormData: CategoryFormData = {
  name: '',
  description: '',
  active: true
};

export function CaveCategories() {
  const { 
    categories, 
    addCategory, 
    updateCategory, 
    deleteCategory, 
    toggleActive 
  } = useCaveCategories();
  
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (editingCategory) {
        // Modificar uma categoria existente
        await updateCategory(editingCategory.id, formData);
      } else {
        // Criar uma nova categoria
        await addCategory(formData);
      }

      setShowModal(false);
      setEditingCategory(null);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Erro ao guardar:', error);
      alert('Erro ao guardar a categoria');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      active: category.active
    });
    setShowModal(true);
  };

  const handleDelete = async (category: any) => {
    if (!confirm(`Tem a certeza que deseja eliminar a categoria "${category.name}"?`)) {
      return;
    }

    try {
      await deleteCategory(category.id);
    } catch (error) {
      console.error('Erro ao apagar:', error);
      alert('Erro ao eliminar a categoria');
    }
  };

  const handleToggleActive = async (category: any) => {
    try {
      await toggleActive(category.id);
    } catch (error) {
      console.error('Erro na atualização:', error);
      alert('Erro ao atualizar a categoria');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary-800 mb-2">Gestão de Categorias</h1>
            <p className="text-primary-600">Organize por categorias</p>
          </div>
          <button
            onClick={() => {
              setEditingCategory(null);
              setFormData(initialFormData);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
          >
            <Plus className="h-5 w-5" />
            <span>Adicionar Categoria</span>
          </button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Total de Categorias</h3>
          <p className="text-2xl font-bold text-accent-600">{categories.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Ativas</h3>
          <p className="text-2xl font-bold text-green-600">
            {categories.filter(cat => cat.active).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="text-lg font-semibold text-primary-800">Inativas</h3>
          <p className="text-2xl font-bold text-red-600">
            {categories.filter(cat => !cat.active).length}
          </p>
        </div>
      </div>

      {/* Lista das categorias */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-primary-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Nome</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Descrição</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Estado</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-primary-800">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-primary-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <Tag className="h-8 w-8 text-accent-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-primary-800">{category.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-primary-600">
                    {category.description || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      category.active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {category.active ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className={`text-sm px-3 py-1 rounded-md transition ${
                          category.active
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                        title={category.active ? 'Desativar' : 'Ativar'}
                      >
                        {category.active ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleEdit(category)}
                        className="text-accent-600 hover:text-accent-800 p-1"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
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
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Tag className="h-16 w-16 text-primary-300 mx-auto mb-4" />
          <p className="text-primary-600 mb-4">Nenhuma categoria criada</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
          >
            Criar a sua primeira categoria
          </button>
        </div>
      )}

      {/* Modal de adição/modificação */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <h2 className="text-2xl font-bold text-primary-800">
                {editingCategory ? 'Editar Categoria' : 'Adicionar Categoria'}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">
                    Nome da Categoria
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                    placeholder="Ex: Especialidades da Casa"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-primary-700 mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                    rows={3}
                    placeholder="Descrição da categoria..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded border-primary-300 text-accent-500 focus:ring-accent-500"
                  />
                  <label htmlFor="active" className="text-sm font-medium text-primary-700">
                    Categoria ativa (visível no menu)
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingCategory(null);
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
                  {isSaving ? 'A gravar...' : (editingCategory ? 'Atualizar' : 'Adicionar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}