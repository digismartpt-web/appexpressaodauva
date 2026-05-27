import { useState, useEffect } from 'react';
import { InitializationService } from '../services/initializationService';

interface InitializationState {
  loading: boolean;
  supabaseAvailable: boolean;
  winesInitialized: boolean;
  source: 'supabase' | 'mock';
  error: string | null;
}

export function useAppInitialization() {
  const [state, setState] = useState<InitializationState>({
    loading: true,
    supabaseAvailable: false,
    winesInitialized: false,
    source: 'mock',
    error: null
  });

  useEffect(() => {
    const initialize = async () => {
      try {
        const result = await InitializationService.autoInitialize();
        
        setState({
          loading: false,
          supabaseAvailable: result.supabaseAvailable,
          winesInitialized: result.winesInitialized,
          source: result.source as 'supabase' | 'mock',
          error: null
        });
      } catch (error: any) {
        setState({
          loading: false,
          supabaseAvailable: false,
          winesInitialized: false,
          source: 'mock',
          error: error.message || 'Erro na inicialização'
        });
      }
    };

    initialize();
  }, []);

  return state;
}