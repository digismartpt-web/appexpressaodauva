// Types de base pour l'application
export type UserRole = 'admin' | 'cave' | 'client';

export type OrderStatus = 'pendente_pagamento' | 'en_attente' | 'confirmee' | 'en_preparation' | 'prete' | 'em_entrega' | 'recuperee' | 'cancelled';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Wine {
  id: string;
  name: string;
  description: string;
  image_url: string;
  prices: {
    bottle: number;
    magnum?: number;
    carton?: number;
  };
  has_unique_price?: boolean;
  unique_price?: number;
  cepages: string[];
  region?: string;
  vintage?: string; // Millésime
  category: string;
  bio?: boolean;
  active?: boolean;
  customizable?: boolean;
  max_custom_ingredients?: number;
  custom_ingredients?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Extra {
  id: string;
  name: string;
  price: number;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  wine_id: string;
  wine_name: string;
  wine_category?: string;
  size: 'bottle' | 'magnum' | 'carton';
  quantity: number;
  price: number;
  removed_ingredients?: string[];
  extras?: Extra[];
  custom_ingredients?: string[];
}

export type DeliveryType = 'delivery' | 'pickup';

export interface Order {
  id: string;
  order_number: number;
  user_id: string;
  user: {
    id?: string;
    full_name: string;
    phone: string;
    address: string;
    email: string;
    role?: string;
  };
  pickup_address: string;
  delivery_type: DeliveryType;
  delivery_address?: string;
  items: OrderItem[];
  total: number;
  delivery_fee?: number;
  status: OrderStatus;
  cancellation_reason?: string;
  preparation_time?: number;
  delivery_time?: number;
  estimated_delivery_time?: string;
  estimated_delivery_time_confirmed?: boolean;
  requested_later_time?: string;
  delivery_distance?: number;
  estimated_time?: number;
  commission_total?: number;
  cave_hidden?: boolean;
  admin_hidden?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CartItem {
  id: string;
  wine: Wine;
  size: 'bottle' | 'magnum' | 'carton';
  quantity: number;
  removedIngredients: string[];
  extras: Extra[];
  customIngredients: string[];
  discount?: number;
  isFree?: boolean;
}

export interface PromotionRule {
  id: string;
  name: string;
  description: string;
  active: boolean;
  type: 'buy_x_get_y_free' | 'buy_x_get_fixed_discount' | 'buy_x_get_percentage';
  buyCondition: {
    count: number;
    category?: string;
    productIds?: string[];
    size?: 'bottle' | 'magnum' | 'carton';
  };
  reward: {
    count: number;
    productId?: string;
    category?: string;
    size?: 'bottle' | 'magnum' | 'carton';
    discountType: 'free' | 'percentage' | 'fixed';
    discountValue: number;
  };
  created_at?: any;
  updated_at?: any;
}