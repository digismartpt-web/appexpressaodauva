import { useState, useEffect } from 'react';
import { Save, Upload, MapPin, Phone, Mail, Clock, Building, Volume2, VolumeX } from 'lucide-react';
import { useCaveSettings, type CaveSettings } from '../../hooks/useCaveSettings';
import { audioNotificationService } from '../../services/audioNotificationService';
import { OpeningHoursInput } from '../../components/OpeningHoursInput';

export function CaveSettings() {
  const { settings: firestoreSettings, loading: loadingSettings, updateSettings } = useCaveSettings();
  const [settings, setSettings] = useState<CaveSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(audioNotificationService.getEnabled());
  const [audioVolume, setAudioVolume] = useState(audioNotificationService.getVolume() * 100);

  // Helper functions for 10% markup
  const applyMarkup = (price: number) => Math.round(price * 1.1 * 100) / 100;
  const removeMarkup = (price: number) => Math.round((price / 1.1) * 100) / 100;

  useEffect(() => {
    if (firestoreSettings) {
      setSettings({
        ...firestoreSettings,
        delivery_fee: firestoreSettings.delivery_fee ? removeMarkup(firestoreSettings.delivery_fee) : 0
      });
    }
  }, [firestoreSettings]);

  if (loadingSettings || !settings) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-500 mx-auto mb-4"></div>
          <p className="text-primary-600">A carregar configurações...</p>
        </div>
      </div>
    );
  }

  // Validar email
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🚀 Gravação das configurações no Supabase');
    console.log('📋 Dados a gravar:', settings);
    setIsSaving(true);
    setMessage(null);

    try {
      if (!settings.name.trim()) {
        throw new Error('O nome da wineria é obrigatório');
      }

      if (settings.email.trim() && !isValidEmail(settings.email)) {
        setMessage({ type: 'error', text: 'O formato do email não é válido' });
        setIsSaving(false);
        return;
      }

      if (!settings.address.trim()) {
        setMessage({ type: 'error', text: 'A morada é obrigatória' });
        setIsSaving(false);
        return;
      }

      console.log('✅ Validation OK, aplicar markup e chamar updateSettings...');
      const settingsToSave = {
        ...settings,
        delivery_fee: settings.delivery_fee ? applyMarkup(settings.delivery_fee) : 0
      };

      const success = await updateSettings(settingsToSave);

      console.log('📊 Resultado de updateSettings:', success);

      if (success) {
        setMessage({ type: 'success', text: 'Configurações guardadas com sucesso!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Erro ao guardar as configurações' });
      }

    } catch (error: any) {
      console.error('❌ Erro ao guardar:', error);
      setMessage({ type: 'error', text: error.message || 'Erro ao guardar as configurações' });
    } finally {
      setIsSaving(false);
    }
  };

  // Atualizar campo
  const updateField = (field: keyof CaveSettings, value: any) => {
    setSettings(prev => prev ? ({ ...prev, [field]: value }) : null);
  };

  // Atualizar horário
  const updateOpeningHour = (day: keyof CaveSettings['opening_hours'], value: string) => {
    setSettings(prev => prev ? ({
      ...prev,
      opening_hours: {
        ...prev.opening_hours,
        [day]: value
      }
    }) : null);
  };

  const dayLabels = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo'
  };

  const handleToggleAudio = () => {
    const newValue = !audioEnabled;
    setAudioEnabled(newValue);
    audioNotificationService.setEnabled(newValue);
  };

  const handleVolumeChange = (value: number) => {
    setAudioVolume(value);
    audioNotificationService.setVolume(value / 100);
  };

  const handleTestSound = async () => {
    await audioNotificationService.playNotification();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-3">
          <Building className="h-8 w-8 text-accent-500" />
          <div>
            <h1 className="text-3xl font-bold text-primary-800">Configurações</h1>
            <p className="text-primary-600">Personalize as suas informações</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success'
          ? 'bg-green-100 border border-green-400 text-green-700'
          : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Logo */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Upload className="h-5 w-5 mr-2" />
            Logo
          </h2>

          <div className="space-y-4">
            {settings.logo_url && (
              <div className="flex justify-center">
                <img
                  src={settings.logo_url}
                  alt="Logo da wineria"
                  className="h-24 w-24 object-contain rounded-lg border"
                  onError={(e) => {
                    console.error('Erro ao carregar logo');
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <div>
              <label htmlFor="logo-url" className="block text-sm font-medium text-primary-700 mb-2">
                URL do Logo
              </label>
              <input
                type="url"
                id="logo-url"
                name="logo-url"
                value={settings.logo_url || ''}
                onChange={(e) => updateField('logo_url', e.target.value)}
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                placeholder="https://exemplo.com/logo.png"
                title="URL do logotipo"
              />
              <p className="text-xs text-primary-500 mt-1">
                Cole aqui o link da sua imagem de logo
              </p>
            </div>
          </div>
        </div>

        {/* Informações Básicas */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Building className="h-5 w-5 mr-2" />
            Informações Básicas
          </h2>

          <div>
            <label htmlFor="wineria-name" className="block text-sm font-medium text-primary-700 mb-1">
              Nome *
            </label>
            <input
              type="text"
              id="wineria-name"
              name="wineria-name"
              value={settings.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              required
              title="Nome da wineria"
              placeholder="Introduza o nome da wineria"
            />
          </div>
        </div>

        {/* Status Aberto/Fechado */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Status do Restaurante
          </h2>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg mb-6">
            <div>
              <p className="font-medium text-primary-800">
                Restaurante {settings.is_open ? 'Aberto' : 'Fechado'}
              </p>
              <p className="text-sm text-primary-600">
                {settings.is_open
                  ? 'Os clientes podem fazer pedidos'
                  : 'Os clientes não podem fazer novos pedidos'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettings(prev => prev ? ({ ...prev, is_open: !prev.is_open }) : null)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${settings.is_open ? 'bg-green-500' : 'bg-red-500'
                }`}
              title={`Alternar para ${settings.is_open ? 'fechado' : 'aberto'}`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${settings.is_open ? 'translate-x-7' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="max-delivery-distance" className="block text-sm font-medium text-primary-700 mb-2">
              Distância Máxima de Entrega (km)
            </label>
            <input
              type="number"
              id="max-delivery-distance"
              name="max-delivery-distance"
              value={settings.max_delivery_distance || ''}
              onChange={(e) => updateField('max_delivery_distance', e.target.value ? Number(e.target.value) : 0)}
              className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Ex: 10"
              min="0"
              step="0.1"
              title="Distância máxima de entrega em km"
            />
            <p className="text-xs text-primary-500 mt-1">
              Deixe em branco ou 0 para não limitar. Os clientes receberão um alerta se o endereço estiver além desta distância.
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="min-delivery-amount" className="block text-sm font-medium text-primary-700 mb-2">
              Valor Mínimo para Entrega (€)
            </label>
            <input
              type="number"
              id="min-delivery-amount"
              name="min-delivery-amount"
              value={settings.min_delivery_amount ?? ''}
              onChange={(e) => updateField('min_delivery_amount', e.target.value ? Number(e.target.value) : 0)}
              className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Ex: 10"
              min="0"
              step="0.5"
              title="Valor mínimo do carrinho para permitir entrega"
            />
            <p className="text-xs text-primary-500 mt-1">
              Valor mínimo em produtos que o cliente deve atingir para poder escolher a opção de entrega.
            </p>
          </div>

          <div className="mt-4">
            <label htmlFor="delivery-fee" className="block text-sm font-medium text-primary-700 mb-2">
              Custo de Entrega (€)
            </label>
            <input
              type="number"
              id="delivery-fee"
              name="delivery-fee"
              value={settings.delivery_fee ?? ''}
              onChange={(e) => updateField('delivery_fee', e.target.value ? Number(e.target.value) : 0)}
              className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Ex: 2.50"
              min="0"
              step="0.01"
              title="Custo de entrega em euros"
            />
            {settings.delivery_fee !== undefined && settings.delivery_fee > 0 && (
              <p className="text-xs text-green-600 mt-1 font-medium italic">
                Final (+10%): {applyMarkup(settings.delivery_fee || 0).toFixed(2)}€
              </p>
            )}
            <p className="text-xs text-primary-500 mt-1">
              Valor que será adicionado automaticamente ao total quando o cliente escolher entrega.
            </p>
          </div>

          <div className="mt-6">
            <label htmlFor="def-prep-time" className="block text-sm font-medium text-primary-700 mb-2">
              Tempo de Preparação Padrão (min)
            </label>
            <input
              type="number"
              id="def-prep-time"
              name="def-prep-time"
              value={settings.default_preparation_time ?? ''}
              onChange={(e) => updateField('default_preparation_time', e.target.value ? Number(e.target.value) : 10)}
              className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
              placeholder="Ex: 10"
              min="1"
              title="Tempo de preparação padrão em minutos"
            />
            <p className="text-xs text-primary-500 mt-1">
              Tempo sugerido ao confirmar uma nova encomenda.
            </p>
          </div>
        </div>

        {/* Contactos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Phone className="h-5 w-5 mr-2" />
            Contactos
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-primary-700 mb-1 flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                Morada de Levantamento *
              </label>
              <textarea
                id="restaurant-address"
                name="restaurant-address"
                value={settings.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                rows={3}
                required
                placeholder="Insira a morada onde os clientes podem levantar os seus pedidos"
                title="Morada do restaurante"
              />
              <p className="text-xs text-primary-500 mt-1">
                Esta morada será exibida aos clientes no resumo dos seus pedidos
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1 flex items-center">
                  <Phone className="h-4 w-4 mr-1" />
                  Telefone
                </label>
                <input
                  type="tel"
                  id="restaurant-phone"
                  name="restaurant-phone"
                  value={settings.phone || ''}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  title="Número de telefone do restaurante"
                  placeholder="+351 900 000 000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-primary-700 mb-1 flex items-center">
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  id="restaurant-email"
                  name="restaurant-email"
                  value={settings.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  className="w-full px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                  title="Email de contacto do restaurante"
                  placeholder="contacto@exemplo.pt"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Horários */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Horários de Funcionamento
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(dayLabels).map(([day, label]) => (
              <OpeningHoursInput
                key={day}
                value={settings.opening_hours?.[day as keyof typeof settings.opening_hours] || ''}
                onChange={(value) => updateOpeningHour(day as keyof typeof settings.opening_hours, value)}
                dayLabel={label}
              />
            ))}
          </div>

          <div className="mt-4 border-t pt-4">
            <label htmlFor="cutoff-minutes" className="block text-sm font-medium text-primary-700 mb-2">
              Bloqueio de Encomendas (minutos antes do fecho)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                id="cutoff-minutes"
                name="cutoff-minutes"
                value={settings.cutoff_minutes_before_closing ?? 30}
                onChange={(e) => updateField('cutoff_minutes_before_closing', e.target.value ? Number(e.target.value) : 30)}
                className="w-24 px-3 py-2 border border-primary-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500"
                min="0"
                max="120"
                title="Minutos antes do fecho para bloquear encomendas"
                placeholder="30"
              />
              <span className="text-sm text-gray-500">minutos</span>
            </div>
            <p className="text-xs text-primary-500 mt-1">
              Define quanto tempo antes do fecho o sistema deixa de aceitar novas encomendas.
            </p>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Dica:</strong> Use a checkbox "Fechado" para dias sem atendimento.
              Clique em "Adicionar pausa" para criar horários separados (ex: almoço e jantar).
            </p>

          </div>
        </div>

        {/* Notificações Sonoras */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-primary-800 mb-4 flex items-center">
            <Volume2 className="h-5 w-5 mr-2" />
            Notificações Sonoras
          </h2>

          <div className="space-y-6">
            {/* Toggle Ativar/Desativar */}
            <div className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
              <div className="flex items-center space-x-3">
                {audioEnabled ? (
                  <Volume2 className="h-6 w-6 text-accent-500" />
                ) : (
                  <VolumeX className="h-6 w-6 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-primary-800">Som de Notificação</p>
                  <p className="text-sm text-primary-600">
                    {audioEnabled ? 'Ativado' : 'Desativado'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${audioEnabled ? 'bg-accent-500' : 'bg-gray-300'
                  }`}
                title={audioEnabled ? 'Desativar som de notificação' : 'Ativar som de notificação'}
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${audioEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`}
                />
              </button>
            </div>

            {/* Controle de Volume */}
            {audioEnabled && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-primary-700">
                    Volume: {Math.round(audioVolume)}%
                  </label>
                  <button
                    type="button"
                    onClick={handleTestSound}
                    className="text-sm text-accent-500 hover:text-accent-600 font-medium"
                  >
                    Testar Som
                  </button>
                </div>
                <input
                  type="range"
                  id="notification-volume"
                  name="notification-volume"
                  min="0"
                  max="100"
                  value={audioVolume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  className="w-full h-2 bg-primary-200 rounded-lg appearance-none cursor-pointer accent-accent-500"
                  title="Volume da notificação sonora"
                />
              </div>
            )}

            <p className="text-sm text-primary-600">
              {audioEnabled
                ? 'Receberá um som de notificação sempre que uma nova encomenda chegar.'
                : 'Ative para receber alertas sonoros de novas encomendas.'}
            </p>
          </div>
        </div>

        {/* Botão de Guardar */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-end space-x-4">
            {/* Message à côté du bouton */}
            {message && (
              <div className={`px-3 py-2 rounded-md text-sm font-medium ${message.type === 'success'
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-red-100 text-red-700 border border-red-300'
                }`}>
                {message.text}
              </div>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 bg-accent-500 text-white px-6 py-3 rounded-md hover:bg-accent-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              <Save className="h-5 w-5" />
              <span>{isSaving ? 'A gravar...' : 'Guardar Configurações'}</span>
            </button>
          </div>
        </div>
      </form >
    </div >
  );
}