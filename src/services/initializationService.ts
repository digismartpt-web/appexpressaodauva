import { supabase } from '../lib/supabase';
import { MOCK_WINES } from '../data/mockData';

export class InitializationService {
  /**
   * Check if Supabase is available
   */
  static isSupabaseAvailable(): boolean {
    return !!supabase;
  }

  /**
   * Check if the wines table is empty
   */
  static async isWineCollectionEmpty(): Promise<boolean> {
    try {
      const { count, error } = await supabase
        .from('wines')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.warn('⚠️ Error checking wines table:', error.message);
        return true;
      }
      return (count ?? 0) === 0;
    } catch (error) {
      console.error('Erro ao verificar a tabela de wines:', error);
      return true;
    }
  }

  /**
   * Initialize Supabase with default wines
   */
  static async initializeWinesInSupabase(): Promise<boolean> {
    try {
      console.log('🍕 Inserting default wines in Supabase...');
      const rows = MOCK_WINES.map((wine: any) => ({
        name: wine.name,
        description: wine.description || '',
        category: wine.category || '',
        image_url: wine.image_url || '',
        ingredients: wine.ingredients || [],
        has_unique_price: wine.has_unique_price ?? false,
        price_small: wine.prices?.small ?? 0,
        price_medium: wine.prices?.medium ?? 0,
        price_large: wine.prices?.large ?? 0,
        customizable: wine.customizable ?? false,
        max_custom_ingredients: wine.max_custom_ingredients ?? 3,
        custom_ingredients: wine.custom_ingredients || [],
        active: true
      }));

      const { error } = await supabase.from('wines').insert(rows);
      if (error) throw error;

      console.log(`✅ ${MOCK_WINES.length} wines added to Supabase`);
      return true;
    } catch (error) {
      console.error('❌ Erro na inicialização das wines:', error);
      return false;
    }
  }

  /**
   * Auto-initialize the application
   */
  static async autoInitialize(): Promise<{
    supabaseAvailable: boolean;
    winesInitialized: boolean;
    source: 'supabase' | 'mock';
  }> {
    const available = this.isSupabaseAvailable();

    if (!available) {
      console.warn('🔧 Supabase not configured - using mock data');
      return { supabaseAvailable: false, winesInitialized: false, source: 'mock' };
    }

    try {
      const isEmpty = await this.isWineCollectionEmpty();

      if (isEmpty) {
        console.log('📦 Empty database detected.');
        return { supabaseAvailable: true, winesInitialized: false, source: 'supabase' };
      }
 else {
        console.log('✅ Supabase already configured with data');
        return { supabaseAvailable: true, winesInitialized: true, source: 'supabase' };
      }
    } catch (error) {
      console.error('❌ Erro na auto-inicialização:', error);
      return { supabaseAvailable: true, winesInitialized: false, source: 'supabase' };
    }
  }
}