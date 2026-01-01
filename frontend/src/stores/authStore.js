import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      organization: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login(email, password);
          const { token, user, organization } = response.data;
          
          localStorage.setItem('token', token);
          
          set({
            user,
            organization,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Login failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          const { token, user, organization } = response.data;
          
          localStorage.setItem('token', token);
          
          set({
            user,
            organization,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Registration failed';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({
          user: null,
          organization: null,
          token: null,
          isAuthenticated: false,
        });
      },

      fetchProfile: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        try {
          const response = await authApi.me();
          const { user, organization } = response.data;
          
          set({
            user,
            organization,
            token,
            isAuthenticated: true,
          });
        } catch (error) {
          localStorage.removeItem('token');
          set({
            user: null,
            organization: null,
            token: null,
            isAuthenticated: false,
          });
        }
      },

      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData },
        }));
      },

      clearError: () => set({ error: null }),

      // Role checks
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'super_admin' || user?.role === 'org_admin';
      },

      isSuperAdmin: () => {
        const { user } = get();
        return user?.role === 'super_admin';
      },

      hasRole: (roles) => {
        const { user } = get();
        return roles.includes(user?.role);
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        organization: state.organization,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
