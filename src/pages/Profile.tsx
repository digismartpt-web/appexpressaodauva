import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Save, X, MapPin } from 'lucide-react';

interface ProfileFormData {
  full_name: string;
  phone: string;
  address: string;
}

export function Profile() {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileFormData>({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateProfile(formData);
      setSuccessMessage('Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setIsEditing(false);
    } catch (error) {
      console.error('Erro ao atualizar o perfil:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      full_name: user.full_name || '',
      phone: user.phone || '',
      address: user.address || '',
    });
    setIsEditing(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-3xl font-bold text-primary-800">O Meu Perfil</h1>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition"
          >
            Editar Perfil
          </button>
        )}
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
          {successMessage}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-8">
        {isEditing ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-primary-700 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 bg-primary-50 border border-primary-300 rounded-md text-primary-600"
              />
              <p className="mt-1 text-sm text-primary-500">O email não pode ser alterado</p>
            </div>

            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-primary-700 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-primary-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-primary-700 mb-1">
                Morada
              </label>
              <textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                required
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center px-4 py-2 text-primary-600 hover:text-primary-800 transition"
                disabled={isSaving}
              >
                <X className="h-5 w-5 mr-2" />
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center bg-accent-500 text-white px-4 py-2 rounded-md hover:bg-accent-600 transition disabled:opacity-50"
                disabled={isSaving}
              >
                <Save className="h-5 w-5 mr-2" />
                {isSaving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-primary-700">Email</label>
              <p className="mt-1 text-primary-900">{user.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700">Nome Completo</label>
              <p className="mt-1 text-primary-900">{user.full_name || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700">Telefone</label>
              <p className="mt-1 text-primary-900">{user.phone || '-'}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-700">Morada</label>
              {user.address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(user.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  {user.address}
                </a>
              ) : (
                <p className="mt-1 text-primary-900">-</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}