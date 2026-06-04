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
      console.log('[AUTH] getSession result:', session ? `user=${session.user.id}` : 'no session');
      if (session?.user) {
        get()._loadUserProfile(session.user.id, session.user.email);
      } else {
        // Tentativa de sessão anónima se não houver sessão ativa
        console.log('[AUTH] No session found, trying anonymous sign-in...');
        supabase.auth.signInAnonymously().then(() => {
          console.log('[AUTH] Anonymous sign-in initiated');
        }).catch(error => {
          console.error('[AUTH] Anonymous sign-in failed:', error);
          set({ user: null, loading: false });
        });
      }
    });

    // 2. Depois subscrevemos as mudanças de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH] onAuthStateChange event:', event, 'userId:', session?.user?.id || 'null', 'userEmail:', session?.user?.email || 'null');
      
      if (session?.user) {
        console.log('[AUTH] Session found, loading profile for user:', session.user.id);
        get()._loadUserProfile(session.user.id, session.user.email);
      } else {
        console.log('[AUTH] No session in onAuthStateChange, setting user=null');
        set({ user: null, loading: false });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  signIn: async (email, password) => {
    console.log('[AUTH] signIn called for email:', email);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('[AUTH] signInWithPassword error:', error.message, error.code);
      throw new Error(error.message || 'Email ou palavra-passes incorretos');
    }
    console.log('[AUTH] signInWithPassword SUCCESS - user:', data?.user?.id, 'session:', !!data?.session);
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
    console.log('[AUTH] _loadUserProfile called for uid:', uid, 'email:', email);
    try {
      const { data: profile, error } = await supabase
        .from('users_profiles')
        .select('*')
        .eq('supabase_auth_id', uid)
        .maybeSingle();

      console.log('[AUTH] _loadUserProfile query result - profile:', profile ? `found (role=${profile.role}, name=${profile.full_name})` : 'null/not found', 'error:', error?.message || 'none', 'errorCode:', error?.code || 'none');

      if (error && error.code !== 'PGRST116') {
        console.error('[AUTH] _loadUserProfile unexpected error:', error);
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
        console.log('[AUTH] Profile FOUND, setting user with role:', userData.role);
        set({ user: userData, loading: false });
      } else {
        console.log('[AUTH] Profile NOT FOUND for uid:', uid, '- setting user=null (check users_profiles table for this supabase_auth_id)');
        // O perfil ainda não existe (pode acontecer para uma sessão anónima ainda não ativa ou nova conta)
        // ATENÇÃO: O trigger DB gere a criação automática para contas reais.
        // Para as sessões anónimas, pode haver um atraso ou comportamento diferente.
        set({ user: null, loading: false });
      }
    } catch (err) {
      console.error('[AUTH] Erro ao carregar o perfil:', err);
      set({ user: null, loading: false });
    }
  }
}));