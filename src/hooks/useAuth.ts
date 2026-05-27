import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

interface ProfileUpdateData {
  full_name: string;
  phone: string;
  address: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: { full_name: string; phone: string; address: string; role: UserRole }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (data: ProfileUpdateData) => Promise<void>;
  initializeAuth: () => void;
  _loadUserProfile: (uid: string, email: string | undefined) => Promise<void>;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,

  initializeAuth: () => {
    // 1. Primeiro tentamos recuperar a sessão existente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        get()._loadUserProfile(session.user.id, session.user.email);
      } else {
        // Tentativa de sessão anónima se não houver sessão ativa
        console.log('👤 [Auth] Nenhum utilizador encontrado, a iniciar sessão anónima...');
        supabase.auth.signInAnonymously().catch(error => {
          console.error('❌ [Auth] Falha na ligação anónima:', error);
          set({ user: null, loading: false });
        });
      }
    });

    // 2. Depois subscrevemos as mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id || 'null');
      
      if (session?.user) {
        get()._loadUserProfile(session.user.id, session.user.email);
      } else {
        set({ user: null, loading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message || 'Email ou palavra-passes incorretos');
  },

  signUp: async (email, password, userData) => {
    // 1. Criar a conta Auth
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: userData.full_name,
          phone: userData.phone,
          address: userData.address,
          role: 'client'
        }
      }
    });

    if (authError) throw new Error(authError.message || 'Erro durante a inscrição no Supabase Auth');
    
    // O perfil será automaticamente criado por um trigger SQL no Supabase.
    // O utilizador receberá um email de confirmação conforme as definições do Supabase.
  },

  signOut: async () => {
    console.log('A terminar sessão...');
    try {
      // Clean cart before signout
      const cartStore = await import('../stores/cartStore');
      cartStore.useCartStore.getState().clearCart();

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      set({ user: null, loading: false });
      console.log('Sessão terminada com sucesso');
    } catch (error: any) {
      console.error('Erro ao terminar sessão:', error);
      throw new Error(error.message || 'Erro durante o término da sessão');
    }
  },

  updateProfile: async (data: ProfileUpdateData) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUser = sessionData.session?.user;
    
    if (!currentUser) throw new Error('Utilizador não ligado');

    const { error } = await supabase
      .from('users_profiles')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('supabase_auth_id', currentUser.id);

    if (error) throw new Error(error.message || 'Erro ao atualizar o perfil');

    // Atualizar o estado local
    set(state => ({
      user: state.user ? {
        ...state.user,
        ...data
      } : null
    }));
  },
  
  // Função utilitária interna para carregar o perfil a partir do supabase_auth_id
  _loadUserProfile: async (uid: string, email: string | undefined) => {
    try {
      const { data: profile, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('supabase_auth_id', uid)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (profile) {
        const userData: User = {
          id: profile.supabase_auth_id,
          email: profile.email || email || '',
          full_name: profile.full_name || '',
          phone: profile.phone || '',
          address: profile.address || '',
          role: profile.role || 'client',
          created_at: profile.created_at
        };
        set({ user: userData, loading: false });
      } else {
        // O perfil ainda não existe (pode acontecer para uma sessão anónima ainda não ativa ou nova conta)
        // ATENÇÃO: O trigger DB gere a criação automática para contas reais.
        // Para as sessões anónimas, pode haver um atraso ou comportamento diferente.
        set({ user: null, loading: false });
      }
    } catch (err) {
      console.error('Erro ao carregar o perfil:', err);
      set({ user: null, loading: false });
    }
  }
}));