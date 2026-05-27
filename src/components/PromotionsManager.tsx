import React, { useState } from 'react';
import { Gift, Plus, Trash2, Edit2, X, Info } from 'lucide-react';
import { promotionsService } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import { usePromotionsStore } from '../stores/promotionsStore';
import { useWinesStore } from '../stores/winesStore';
import type { PromotionRule } from '../types';

export const PromotionsManager: React.FC = () => {
    const { user: authUser } = useAuth();
    const { allPromotions: promotions, loading } = usePromotionsStore();
    const { allWines: wines, categories } = useWinesStore();
    
    const [isEditing, setIsEditing] = useState(false);
    const [currentPromo, setCurrentPromo] = useState<Partial<PromotionRule> | null>(null);
    // Removidos useEffects de subscrição local (geridos globalmente)

    const handleSave = async () => {
        if (!currentPromo?.name) return alert('Por favor, indique um nome para a promoção.');

        try {
            console.log('--- SAVING PROMOTION ---');
            console.log('Dados:', currentPromo);

            if (currentPromo.id) {
                await promotionsService.updatePromotion(currentPromo.id, currentPromo);
            } else {
                await promotionsService.addPromotion(currentPromo as Omit<PromotionRule, 'id'>);
            }
            setIsEditing(false);
            setCurrentPromo(null);
            // Fallback refresh
            promotionsService.getAllPromotions().then(promos => usePromotionsStore.setState({ allPromotions: promos }));
            alert('Promoção salva com sucesso! 🎉');
        } catch (error: any) {
            console.error('ERRO DETALHADO:', error);
            alert(`🛑 Erro ao guardar a promoção: ${error.message || error.code || 'Desconhecido'}. Verifique as políticas RLS do Supabase.`);
        }
    };

    const handleEdit = (promo: PromotionRule) => {
        setCurrentPromo({ ...promo });
        setIsEditing(true);
    };

    if (loading) return <div className="p-8 text-center animate-pulse">Carregando dados da wineria...</div>;

    const hasPermission = authUser?.role === 'admin' || authUser?.role === 'cave';

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-primary-100">
            {/* Debug Banner - Essencial para resolver o problema de permissão */}
            {!hasPermission && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    <span className="font-bold">Acesso Restrito:</span> Apenas administradores podem guardar alterações.
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-primary-900 flex items-center gap-2">
                    <Gift className="text-accent-500" />
                    Gestão de Promoções Avançada
                </h2>
                <button
                    onClick={() => {
                        setCurrentPromo({
                            name: '', description: '', active: true, type: 'buy_x_get_y_free',
                            buyCondition: { count: 3, category: '' },
                            reward: { count: 1, discountType: 'free', discountValue: 100 }
                        });
                        setIsEditing(true);
                    }}
                    className="flex items-center gap-2 bg-accent-500 text-white px-5 py-2 rounded-lg font-bold hover:bg-accent-600 transition shadow-md"
                >
                    <Plus className="h-4 w-4" /> Nova Promoção
                </button>
            </div>

            {isEditing && currentPromo && (
                <div className="mb-10 p-6 border-2 border-accent-100 rounded-xl bg-accent-50/30">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-primary-800">
                            {currentPromo.id ? '✏️ Editar' : '✨ Criar'} Promoção
                        </h3>
                        <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-gray-100 rounded-full">
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-primary-700 mb-1">Nome da Promoção *</label>
                                <input
                                    type="text"
                                    value={currentPromo.name || ''}
                                    onChange={e => setCurrentPromo({ ...currentPromo, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-accent-500 outline-none"
                                    placeholder="Ex: Compre 3 Ganhe 1"
                                    title="Nome da promoção"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-primary-700 mb-1">Descrição Comercial</label>
                                <input
                                    type="text"
                                    value={currentPromo.description || ''}
                                    onChange={e => setCurrentPromo({ ...currentPromo, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-accent-500 outline-none"
                                    placeholder="Ex: Válido para todas as wines médias"
                                    title="Descrição da promoção"
                                />
                            </div>
                        </div>

                        {/* Buy Condition Section (CRITÉRIOS COMPLETOS) */}
                        <div className="bg-white p-4 rounded-lg border border-primary-100 shadow-sm">
                            <h4 className="text-sm font-bold text-primary-800 mb-4 flex items-center gap-2 uppercase tracking-tight">
                                <Plus className="h-4 w-4 text-primary-500" /> Condição: Ao Comprar
                            </h4>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Qtd:</span>
                                    <input
                                        type="number"
                                        value={currentPromo.buyCondition?.count || 0}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            buyCondition: { ...currentPromo.buyCondition!, count: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-16 px-2 py-1 border rounded focus:ring-1 focus:ring-primary-500 outline-none"
                                        title="Quantidade necessária"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Categoria:</span>
                                    <select
                                        value={currentPromo.buyCondition?.category || ''}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            buyCondition: { ...currentPromo.buyCondition!, category: e.target.value }
                                        })}
                                        className="px-2 py-1 border rounded min-w-[140px]"
                                        title="Categoria da promoção"
                                    >
                                        <option value="">Todas as Categorias</option>
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Tamanho:</span>
                                    <select
                                        value={currentPromo.buyCondition?.size || ''}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            buyCondition: { ...currentPromo.buyCondition!, size: (e.target.value as any) || undefined }
                                        })}
                                        className="px-2 py-1 border rounded"
                                        title="Tamanho necessário"
                                    >
                                        <option value="">Qualquer Tamanho</option>
                                        <option value="small">Pequena</option>
                                        <option value="medium">Média</option>
                                        <option value="large">Grande</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Reward Section (CRITÉRIOS COMPLETOS) */}
                        <div className="bg-white p-4 rounded-lg border border-accent-100 shadow-sm">
                            <h4 className="text-sm font-bold text-accent-700 mb-4 flex items-center gap-2 uppercase tracking-tight">
                                <Gift className="h-4 w-4" /> Recompensa: O Cliente Ganha
                            </h4>
                            <div className="flex flex-wrap items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Qtd:</span>
                                    <input
                                        type="number"
                                        value={currentPromo.reward?.count || 0}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            reward: { ...currentPromo.reward!, count: parseInt(e.target.value) || 0 }
                                        })}
                                        className="w-16 px-2 py-1 border rounded focus:ring-1 focus:ring-accent-500 outline-none"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Categoria:</span>
                                    <select
                                        value={currentPromo.reward?.category || ''}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            reward: { ...currentPromo.reward!, category: e.target.value, productId: '' }
                                        })}
                                        className="px-2 py-1 border rounded"
                                    >
                                        <option value="">Qualquer Categoria</option>
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Produto:</span>
                                    <select
                                        value={currentPromo.reward?.productId || ''}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            reward: { ...currentPromo.reward!, productId: e.target.value }
                                        })}
                                        className="px-2 py-1 border rounded max-w-[200px]"
                                    >
                                        <option value="">Qualquer Item {currentPromo.reward?.category ? `da Categoria ${currentPromo.reward.category}` : ''}</option>
                                        {wines
                                            .filter(p => !currentPromo.reward?.category || p.category === currentPromo.reward.category)
                                            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
                                        }
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Tamanho:</span>
                                    <select
                                        value={currentPromo.reward?.size || ''}
                                        onChange={e => setCurrentPromo({
                                            ...currentPromo,
                                            reward: { ...currentPromo.reward!, size: (e.target.value as any) || undefined }
                                        })}
                                        className="px-2 py-1 border rounded"
                                    >
                                        <option value="">Mesmo da Compra</option>
                                        <option value="small">Pequena</option>
                                        <option value="medium">Média</option>
                                        <option value="large">Grande</option>
                                    </select>
                                </div>
                            </div>
                            <div className="mt-3 text-[10px] text-accent-700 font-bold bg-accent-50 px-2 py-0.5 rounded-full inline-block">
                                AUTOMÁTICO: 100% DE DESCONTO (GRÁTIS)
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-5 py-2 text-gray-500 hover:text-gray-700 font-medium transition"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-8 py-2 bg-primary-800 text-white rounded-lg font-bold hover:bg-primary-900 transition shadow-md"
                            >
                                {currentPromo.id ? 'Guardar Alterações' : 'Criar Promoção'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid gap-4">
                {promotions.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        Nenhuma promoção ativa no momento.
                    </div>
                ) : (
                    promotions.map(promo => (
                        <div key={promo.id} className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100 hover:border-accent-200 transition-all shadow-sm hover:shadow">
                            <div className="flex items-center gap-5">
                                <div className={`p-4 rounded-full ${promo.active ? 'bg-accent-100 text-accent-600' : 'bg-gray-100 text-gray-400'}`}>
                                    <Gift className="h-6 w-6" />
                                </div>
                                <div>
                                    <p className="font-bold text-primary-900 text-lg leading-tight">{promo.name}</p>
                                    <p className="text-sm text-gray-500 mb-2">{promo.description}</p>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-1 rounded-md border border-primary-100 uppercase font-black">
                                            COMPRA: {promo.buyCondition?.count || 0}x {promo.buyCondition?.category || 'Items'} {promo.buyCondition?.size ? `(${promo.buyCondition.size})` : ''}
                                        </span>
                                        <span className="text-[10px] bg-accent-50 text-accent-800 px-2 py-1 rounded-md border border-accent-100 uppercase font-black">
                                            GANHA: {promo.reward?.count || 0}x {
                                                promo.reward?.productId
                                                    ? (wines || []).find(p => p.id === promo.reward?.productId)?.name
                                                    : (promo.reward?.category || 'Grátis')
                                            } {promo.reward?.size ? `(${promo.reward.size})` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <div className="flex flex-col items-center gap-1 min-w-[100px]">
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${promo.active ? 'text-green-600' : 'text-gray-400'}`}>
                                        {promo.active ? 'Ativa' : 'Pausada'}
                                    </span>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await promotionsService.updatePromotion(promo.id, { active: !promo.active });
                                            } catch (error) {
                                                alert('Erro ao alterar status da promoção. Verifique as permissões.');
                                            }
                                        }}
                                        title={promo.active ? 'Desativar Promoção' : 'Ativar Promoção'}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 ${promo.active ? 'bg-green-500' : 'bg-gray-300'
                                            }`}
                                    >
                                        <span
                                            className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${promo.active ? 'translate-x-5' : 'translate-x-1'
                                                }`}
                                        />
                                    </button>
                                </div>
                                <button
                                    onClick={() => handleEdit(promo)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Editar"
                                >
                                    <Edit2 className="h-5 w-5" />
                                </button>
                                <button
                                    onClick={async () => { 
                                        if (window.confirm('Deseja eliminar permanentemente esta promoção?')) {
                                            await promotionsService.deletePromotion(promo.id);
                                            // Fallback refresh
                                            promotionsService.getAllPromotions().then(promos => usePromotionsStore.setState({ allPromotions: promos }));
                                        }
                                    }}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                                    title="Eliminar"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
