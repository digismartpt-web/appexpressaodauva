import { useSettingsStore } from '../stores/settingsStore';

export interface CaveSettings {
  logo_url: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  delete_password?: string;
  is_open: boolean;
  max_delivery_distance?: number;
  min_delivery_amount?: number;
  delivery_fee?: number;
  default_preparation_time?: number;
  default_delivery_time?: number;
  cutoff_minutes_before_closing?: number;
  banner_active?: boolean;
  banner_image_url?: string;
  available_banner_images?: string[];
  service_fee_percentage?: number;
  opening_hours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

export function useCaveSettings() {
  const { settings, loading, updateSettings } = useSettingsStore();

  return { settings, loading, updateSettings };
}