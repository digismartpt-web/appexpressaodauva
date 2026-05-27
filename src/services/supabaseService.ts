import { supabase } from '../lib/supabase';
import type { Wine, Order, User, OrderStatus, Extra, PromotionRule } from '../types';

export const COLLECTIONS = {
  USERS: 'users_profiles',
  WINES: 'wines',
  ORDERS: 'orders',
  EXTRAS: 'extras',
  PROMOTIONS: 'promotions',
  BANNER_GALLERY: 'banner_gallery',
  CATEGORIES: 'categories'
} as const;

// Users Service
export const usersService = {
  async createUser(userId: string, userData: Partial<User>) {
    const { error } = await supabase.from(COLLECTIONS.USERS).upsert({
      supabase_auth_id: userId,
      ...userData,
      updated_at: new Date().toISOString()
    });
    if (error) throw new Error(error.message);
  },

  async updateUser(userId: string, userData: Partial<User>) {
    const { error } = await supabase.from(COLLECTIONS.USERS).update({
      ...userData,
      updated_at: new Date().toISOString()
    }).eq('supabase_auth_id', userId);

    if (error) throw new Error(error.message);
  },

  async getUser(userId: string): Promise<User | null> {
    const { data, error } = await supabase.from(COLLECTIONS.USERS).select('*').eq('supabase_auth_id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.supabase_auth_id,
      ...data
    } as User;
  },

};

// Wines Service
export const winesService = {
  async createWine(wineData: Omit<Wine, 'id'>) {
    // Note: RLS will check if user is admin/wineria
    const cleanData: any = {
      name: wineData.name || '',
      description: wineData.description || '',
      category: wineData.category || '',
      image_url: wineData.image_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800',
      ingredients: wineData.ingredients || [],
      customizable: wineData.customizable || false,
      max_custom_ingredients: wineData.max_custom_ingredients || 3,
      custom_ingredients: wineData.custom_ingredients || [],
      active: true,
    };

    if (wineData.has_unique_price) {
      // Quando é preço único, mapeamos para price_medium e limpamos os outros
      cleanData.has_unique_price = true;
      cleanData.price_medium = wineData.unique_price || 0;
      cleanData.price_small = 0;
      cleanData.price_large = 0;
    } else {
      cleanData.has_unique_price = false;
      cleanData.price_small = wineData.prices?.small || 0;
      cleanData.price_medium = wineData.prices?.medium || 0;
      cleanData.price_large = wineData.prices?.large || 0;
    }

    const { data, error } = await supabase.from(COLLECTIONS.WINES).insert(cleanData).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updateWine(wineId: string, wineData: Partial<Wine>) {
    const cleanData: any = { updated_at: new Date().toISOString() };
    if (wineData.name !== undefined) cleanData.name = wineData.name;
    if (wineData.description !== undefined) cleanData.description = wineData.description;
    if (wineData.category !== undefined) cleanData.category = wineData.category;
    if (wineData.image_url !== undefined) cleanData.image_url = wineData.image_url;
    if (wineData.ingredients !== undefined) cleanData.ingredients = wineData.ingredients;
    if (wineData.active !== undefined) cleanData.active = wineData.active;
    if (wineData.customizable !== undefined) cleanData.customizable = wineData.customizable;
    if (wineData.max_custom_ingredients !== undefined) cleanData.max_custom_ingredients = wineData.max_custom_ingredients;
    if (wineData.custom_ingredients !== undefined) cleanData.custom_ingredients = wineData.custom_ingredients;

    if (wineData.has_unique_price !== undefined) {
      cleanData.has_unique_price = wineData.has_unique_price;
    }

    if (cleanData.has_unique_price === true) {
      // Forçar limpeza dos outros tamanhos se estamos em modo preço único
      cleanData.price_small = 0;
      cleanData.price_large = 0;
      if (wineData.unique_price !== undefined) {
        cleanData.price_medium = wineData.unique_price;
      }
    } else if (cleanData.has_unique_price === false || (cleanData.has_unique_price === undefined && wineData.prices !== undefined)) {
      // Estamos em modo preços por tamanho ou atualizando os preços
      if (wineData.prices !== undefined) {
        cleanData.price_small = wineData.prices.small || 0;
        cleanData.price_medium = wineData.prices.medium || 0;
        cleanData.price_large = wineData.prices.large || 0;
      }
    }

    const { error } = await supabase.from(COLLECTIONS.WINES).update(cleanData).eq('id', wineId);
    if (error) throw new Error(error.message);
  },

  async deleteWine(wineId: string) {
    const { error } = await supabase.from(COLLECTIONS.WINES).delete().eq('id', wineId);
    if (error) throw new Error(error.message);
  },

  mapWine(doc: any): Wine {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      category: doc.category,
      image_url: doc.image_url,
      has_unique_price: doc.has_unique_price,
      unique_price: doc.has_unique_price ? doc.price_medium : undefined,
      prices: {
        small: doc.price_small,
        medium: doc.price_medium,
        large: doc.price_large
      },
      customizable: doc.customizable,
      max_custom_ingredients: doc.max_custom_ingredients,
      custom_ingredients: doc.custom_ingredients,
      ingredients: doc.ingredients,
      active: doc.active,
      created_at: doc.created_at
    };
  },

  async getAllWines(): Promise<Wine[]> {
    const { data, error } = await supabase.from(COLLECTIONS.WINES).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).filter(p => p.active !== false).map(this.mapWine);
  },

  async getAllWinesForAdmin(): Promise<Wine[]> {
    const { data, error } = await supabase.from(COLLECTIONS.WINES).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(this.mapWine);
  },

  subscribeToActiveWines(callback: (wines: Wine[]) => void) {
    // First load
    supabase.from(COLLECTIONS.WINES).select('*').eq('active', true).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) callback(data.map(this.mapWine));
    });

    const channelId = `active_wines_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.WINES }, (payload) => {
        console.log('🔔 [Realtime] Mudança em wines (cliente):', payload.eventType);
        supabase.from(COLLECTIONS.WINES).select('*').eq('active', true).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) callback(data.map(this.mapWine));
        });
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });

    return () => { supabase.removeChannel(channel); };
  },

  subscribeToAllWines(callback: (wines: Wine[]) => void) {
    supabase.from(COLLECTIONS.WINES).select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) callback(data.map(this.mapWine));
    });

    const channelId = `all_wines_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.WINES }, (payload) => {
        console.log('🔔 [Realtime] Mudança em todas as wines:', payload.eventType);
        supabase.from(COLLECTIONS.WINES).select('*').order('created_at', { ascending: false }).then(({ data }) => {
          if (data) callback(data.map(this.mapWine));
        });
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });

    return () => { supabase.removeChannel(channel); };
  }
};

// Orders Service
export const ordersService = {
  async createOrder(orderData: any): Promise<string> {
    const orderNumber = 20000 + Math.floor(Date.now() / 1000) % 100000;

    const cleanData: any = {
      ...orderData,
      user_supabase_id: orderData.user_id,
      user_email: orderData.user?.email || 'N/A',
      user_full_name: orderData.user?.full_name || 'Anonyme',
      user_phone: orderData.user?.phone || '',
      user_address: orderData.user?.address || '',
      order_number: orderNumber.toString(),
      updated_at: new Date().toISOString()
    };
    
    // Remover o objeto 'user' e o 'user_id' antes de inserir (não são colunas)
    delete cleanData.user;
    delete cleanData.user_id;

    const { data, error } = await supabase.from(COLLECTIONS.ORDERS).insert(cleanData).select('id').single();
    if (error) {
      console.error('❌ Erro no Supabase Insert:', error);
      throw new Error(error.message);
    }
    return data.id;
  },

  async createStripeSession(orderId: string, orderItems: any[], userEmail: string) {
    // Utiliser fetch direct pour mieux capturer les erreurs détaillées du serveur
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const functionUrl = `${supabaseUrl}/functions/v1/create-checkout-session`;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token || supabaseAnonKey;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': supabaseAnonKey
        },
        body: JSON.stringify({
          orderId,
          items: orderItems,
          customerEmail: userEmail,
          successUrl: `${window.location.origin}/payment-success`,
          cancelUrl: window.location.origin
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro bruto da Edge Function:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || errorJson.details || errorJson.message || `Erro ${response.status}: ${errorText}`);
        } catch (e) {
          throw new Error(`Erro ${response.status}: ${errorText.substring(0, 100)}`);
        }
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      console.error('❌ Erro ao chamar Edge Function:', error);
      throw new Error(error.message || 'Falha ao processar pagamento');
    }
  },

  async confirmPayment(orderId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from(COLLECTIONS.ORDERS).update({
        status: 'en_attente',
        updated_at: new Date().toISOString()
      }).eq('id', orderId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Erro ao confirmar pagamento:', error);
      return false;
    }
  },

  async updateOrderStatus(orderId: string, status: OrderStatus, estimatedTime?: string, cancellationReason?: string) {
    const updateData: any = { status, updated_at: new Date().toISOString() };
    if (estimatedTime) updateData.estimated_delivery_time = estimatedTime;
    if (cancellationReason) updateData.cancellation_reason = cancellationReason;
    
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update(updateData).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async updateOrderPreparationTime(orderId: string, preparationTime: number) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ 
      preparation_time: preparationTime, 
      updated_at: new Date().toISOString() 
    }).eq('id', orderId); 
    if (error) throw new Error(error.message);
  },

  async updateOrderDeliveryTime(orderId: string, deliveryTime: number, distance?: number) {
    const cleanData: any = { 
      status: 'em_entrega', 
      delivery_time: deliveryTime,
      delivery_distance: distance,
      updated_at: new Date().toISOString() 
    };
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update(cleanData).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async deleteOrder(orderId: string) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).delete().eq('id', orderId);
    if (error) throw new Error('Falha ao apagar encomenda: ' + error.message);
  },

  async updateEstimatedDeliveryTime(orderId: string, estimatedTime: string) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ 
      estimated_delivery_time: estimatedTime,
      updated_at: new Date().toISOString() 
    }).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async confirmEstimatedDeliveryTime(orderId: string) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ 
      estimated_delivery_time_confirmed: true,
      updated_at: new Date().toISOString() 
    }).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async requestLaterDeliveryTime(orderId: string, requestedTime: string) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ 
      requested_later_time: requestedTime,
      updated_at: new Date().toISOString() 
    }).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  async hideOrderForAdmin(orderId: string) {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ 
      admin_hidden: true,
      updated_at: new Date().toISOString() 
    }).eq('id', orderId);
    if (error) throw new Error(error.message);
  },

  mapOrder(doc: any): Order {
    return {
      id: doc.id,
      user_id: doc.user_supabase_id,
      user: {
        id: doc.user_supabase_id,
        email: doc.user_email,
        full_name: doc.user_full_name,
        phone: doc.user_phone,
        address: doc.user_address || '',
        role: 'client' // approximated
      },
      pickup_address: doc.pickup_address || undefined,
      delivery_type: doc.delivery_type as 'delivery' | 'pickup',
      delivery_address: doc.delivery_address || undefined,
      delivery_distance: doc.delivery_distance,
      items: doc.items,
      total: doc.total || doc.total_amount || doc.amount || 0,
      status: doc.status as OrderStatus,
      order_number: parseInt(doc.order_number),
      created_at: doc.created_at,
      cave_hidden: doc.cave_hidden,
      admin_hidden: doc.admin_hidden,
      cancellation_reason: doc.cancellation_reason,
      preparation_time: doc.preparation_time,
      delivery_time: doc.delivery_time,
      estimated_delivery_time: doc.estimated_delivery_time,
      estimated_delivery_time_confirmed: doc.estimated_delivery_time_confirmed,
      requested_later_time: doc.requested_later_time,
      delivery_fee: doc.delivery_fee,
      commission_total: doc.commission_total,
      updated_at: doc.updated_at
    };
  },

  async getUserOrders(userId: string): Promise<Order[]> {
    const { data, error } = await supabase.from(COLLECTIONS.ORDERS).select('*').eq('user_supabase_id', userId).order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(this.mapOrder);
  },

  async getAllOrders(): Promise<Order[]> {
    const { data, error } = await supabase.from(COLLECTIONS.ORDERS).select('*').order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(this.mapOrder);
  },

  subscribeToUserOrders(userId: string, callback: (orders: Order[]) => void) {
    this.getUserOrders(userId).then(callback);

    const channel = supabase.channel(`orders_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.ORDERS, filter: `user_supabase_id=eq.${userId}` }, (payload) => {
        console.log(`🔔 [Realtime] Mudança nas encomendas do utilizador ${userId}:`, payload);
        this.getUserOrders(userId).then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição orders_${userId}:`, status);
      });

    return () => { supabase.removeChannel(channel); };
  },

  subscribeToAllOrders(callback: (orders: Order[]) => void) {
    const channelId = `orders_all_${Date.now()}`;
    console.log(`📡 [SupabaseService] Iniciando subscribeToAllOrders (ID: ${channelId})...`);
    
    // Fetch inicial imediato
    this.getAllOrders().then(callback);

    const channel = supabase.channel(channelId)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: COLLECTIONS.ORDERS 
      }, (payload) => {
        const newId = (payload.new as any)?.id;
        console.log(`🔔 [Realtime] Mudança detetada no canal ${channelId}:`, payload.eventType, newId);
        // Re-fetch completo para garantir dados mapeados corretamente
        this.getAllOrders().then(callback);
      })
      .subscribe((status, err) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
        if (err) console.error(`❌ [Realtime] Erro na subscrição ${channelId}:`, err);
        
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ [Realtime] Erro crítico. A tabela "orders" pode não ter o Realtime ativado no Supabase Dashboard (Replication).');
        }
      });

    return () => { 
      console.log(`🔌 [Realtime] Removendo canal ${channelId}`);
      supabase.removeChannel(channel); 
    };
  },

  subscribeToOrdersByStatus(status: OrderStatus, callback: (orders: Order[]) => void) {
    supabase.from(COLLECTIONS.ORDERS).select('*').eq('status', status).order('created_at', { ascending: false }).then(({ data }) => {
      if (data) callback(data.map(this.mapOrder));
    });

    const channel = supabase.channel(`orders_${status}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.ORDERS, filter: `status=eq.${status}` }, () => {
        supabase.from(COLLECTIONS.ORDERS).select('*').eq('status', status).order('created_at', { ascending: false }).then(({ data }) => {
          if (data) callback(data.map(this.mapOrder));
        });
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  async deleteAllOrders() {
    const { error } = await supabase.from(COLLECTIONS.ORDERS).update({ cave_hidden: true }).not('id', 'is', null);
    if (error) throw new Error(error.message);
  }
};

// Extras Service
export const extrasService = {
  async createExtra(extraData: Omit<Extra, 'id'>) {
    const { data, error } = await supabase.from(COLLECTIONS.EXTRAS).insert({ ...extraData, active: true }).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updateExtra(extraId: string, extraData: Partial<Extra>) {
    const { error } = await supabase.from(COLLECTIONS.EXTRAS).update({ ...extraData, updated_at: new Date().toISOString() }).eq('id', extraId);
    if (error) throw new Error(error.message);
  },

  async deleteExtra(extraId: string) {
    const { error } = await supabase.from(COLLECTIONS.EXTRAS).delete().eq('id', extraId);
    if (error) throw new Error(error.message);
  },

  async getAllExtras(): Promise<Extra[]> {
    const { data, error } = await supabase.from(COLLECTIONS.EXTRAS).select('*').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data || []).filter(e => e.active !== false) as Extra[];
  },

  async getAllExtrasForAdmin(): Promise<Extra[]> {
    const { data, error } = await supabase.from(COLLECTIONS.EXTRAS).select('*').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data as Extra[];
  },

  subscribeToActiveExtras(callback: (extras: Extra[]) => void) {
    this.getAllExtras().then(callback);
    const channelId = `extras_active_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.EXTRAS }, (payload) => {
        console.log('🔔 [Realtime] Mudança ativa em extras detetada:', payload.eventType);
        this.getAllExtras().then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });
    return () => { 
      console.log(`🔌 [Realtime] Removendo canal ${channelId}`);
      supabase.removeChannel(channel); 
    };
  },

  subscribeToAllExtras(callback: (extras: Extra[]) => void) {
    this.getAllExtrasForAdmin().then(callback);
    const channelId = `extras_all_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.EXTRAS }, (payload) => {
        console.log('🔔 [Realtime] Mudança total em extras detetada:', payload.eventType);
        this.getAllExtrasForAdmin().then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });
    return () => { 
      console.log(`🔌 [Realtime] Removendo canal ${channelId}`);
      supabase.removeChannel(channel); 
    };
  }
};

// Categories Service
export const categoriesService = {
  async createCategory(categoryData: { name: string; description?: string; active: boolean }) {
    const { data, error } = await supabase.from(COLLECTIONS.CATEGORIES).insert(categoryData).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updateCategory(categoryId: string, categoryData: Partial<{ name: string; description?: string; active: boolean }>) {
    const { error } = await supabase.from(COLLECTIONS.CATEGORIES).update({ ...categoryData, updated_at: new Date().toISOString() }).eq('id', categoryId);
    if (error) throw new Error(error.message);
  },

  async deleteCategory(categoryId: string) {
    const { error } = await supabase.from(COLLECTIONS.CATEGORIES).delete().eq('id', categoryId);
    if (error) throw new Error(error.message);
  },

  async getAllCategories(): Promise<any[]> {
    const { data, error } = await supabase.from(COLLECTIONS.CATEGORIES).select('*').order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  subscribeToCategories(callback: (categories: any[]) => void) {
    this.getAllCategories().then(callback);
    
    const channelId = `categories_all_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.CATEGORIES }, (payload) => {
        console.log('🔔 [Realtime] Mudança em categorias:', payload.eventType);
        this.getAllCategories().then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });
      
    return () => { supabase.removeChannel(channel); };
  }
};

// Promotions Service
export const promotionsService = {
  mapPromotion(doc: any): PromotionRule {
    return {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      active: doc.active,
      type: doc.type,
      buyCondition: {
        count: doc.buy_condition?.count || 0,
        category: doc.buy_condition?.category,
        productIds: doc.buy_condition?.product_ids || doc.buy_condition?.productIds,
        size: doc.buy_condition?.size
      },
      reward: {
        count: doc.reward?.count || 0,
        productId: doc.reward?.product_id || doc.reward?.productId,
        category: doc.reward?.category,
        size: doc.reward?.size,
        discountType: doc.reward?.discount_type || doc.reward?.discountType || 'free',
        discountValue: doc.reward?.discount_value || doc.reward?.discountValue || 0
      },
      created_at: doc.created_at,
      updated_at: doc.updated_at
    };
  },

  unmapPromotion(promo: Partial<PromotionRule>): any {
    const unmapped: any = { 
      name: promo.name,
      description: promo.description,
      active: promo.active,
      type: promo.type
    };

    if (promo.buyCondition) {
      unmapped.buy_condition = {
        count: promo.buyCondition.count,
        category: promo.buyCondition.category,
        product_ids: promo.buyCondition.productIds,
        size: promo.buyCondition.size
      };
    }

    if (promo.reward) {
      unmapped.reward = {
        count: promo.reward.count,
        product_id: promo.reward.productId,
        category: promo.reward.category,
        size: promo.reward.size,
        discount_type: promo.reward.discountType,
        discount_value: promo.reward.discountValue
      };
    }

    return unmapped;
  },

  async getActivePromotions(): Promise<PromotionRule[]> {
    const { data, error } = await supabase.from(COLLECTIONS.PROMOTIONS).select('*').eq('active', true);
    if (error) throw new Error(error.message);
    return (data || []).map(d => this.mapPromotion(d));
  },

  subscribeToActivePromotions(callback: (promotions: PromotionRule[]) => void) {
    this.getActivePromotions().then(callback);
    
    const channelId = `promotions_active_listener_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      // Escutamos TODAS as mudanças na tabela para apanhar desativações (que sairiam do filtro active=eq.true)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.PROMOTIONS }, (payload) => {
        console.log('🔔 [Realtime] Mudança detetada para promoções do cliente:', payload.eventType);
        this.getActivePromotions().then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição do cliente ${channelId}:`, status);
      });
      
    return () => { supabase.removeChannel(channel); };
  },

  async getAllPromotions(): Promise<PromotionRule[]> {
    const { data, error } = await supabase.from(COLLECTIONS.PROMOTIONS).select('*');
    if (error) throw new Error(error.message);
    return (data || []).map(d => this.mapPromotion(d));
  },

  subscribeToAllPromotions(callback: (promotions: PromotionRule[]) => void) {
    this.getAllPromotions().then(callback);
    
    const channelId = `promotions_all_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.PROMOTIONS }, (payload) => {
        console.log('🔔 [Realtime] Mudança em todas as promoções:', payload.eventType);
        this.getAllPromotions().then(callback);
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });
      
    return () => { supabase.removeChannel(channel); };
  },

  async addPromotion(promotion: Omit<PromotionRule, 'id'>): Promise<string> {
    const unmapped = this.unmapPromotion(promotion);
    const { data, error } = await supabase.from(COLLECTIONS.PROMOTIONS).insert(unmapped).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async updatePromotion(id: string, promotion: Partial<PromotionRule>): Promise<void> {
    const unmapped = this.unmapPromotion(promotion);
    unmapped.updated_at = new Date().toISOString();
    const { error } = await supabase.from(COLLECTIONS.PROMOTIONS).update(unmapped).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async deletePromotion(id: string): Promise<void> {
    const { error } = await supabase.from(COLLECTIONS.PROMOTIONS).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
};

// Banner Gallery Service
export const bannerGalleryService = {
  async getAllImages(): Promise<{ id: string; url: string; name: string; created_at: string }[]> {
    const { data, error } = await supabase.from(COLLECTIONS.BANNER_GALLERY).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(d => ({ id: d.id, url: d.image_url, name: d.name, created_at: d.created_at }));
  },

  async addImage(url: string, name: string): Promise<string> {
    const { data, error } = await supabase.from(COLLECTIONS.BANNER_GALLERY).insert({ image_url: url, name }).select('id').single();
    if (error) throw new Error(error.message);
    return data.id;
  },

  async deleteImage(id: string): Promise<void> {
    const { error } = await supabase.from(COLLECTIONS.BANNER_GALLERY).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  subscribeToGallery(callback: (images: any[]) => void, errorCallback?: (error: any) => void) {
    this.getAllImages().then(callback).catch(e => errorCallback && errorCallback(e));
    
    const channelId = `banner_gallery_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: COLLECTIONS.BANNER_GALLERY }, (payload) => {
        console.log('🔔 [Realtime] Mudança na galeria:', payload.eventType);
        this.getAllImages().then(callback).catch(e => errorCallback && errorCallback(e));
      }).subscribe((status) => {
        console.log(`🛰️ [Realtime] Estado da subscrição ${channelId}:`, status);
      });
      
    return () => { supabase.removeChannel(channel); };
  }
};

// Storage Service
export const storageService = {
  async uploadImage(file: File): Promise<string> {
    // Generate a unique filename using timestamp
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    // Supabase bucket is 'Images wines' as defined
    const { error } = await supabase.storage.from('Images wines').upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (error) {
      console.error('Storage error:', error);
      throw new Error(error.message);
    }

    // Get public URL
    const { data: publicData } = supabase.storage.from('Images wines').getPublicUrl(fileName);
    return publicData.publicUrl;
  }
};
