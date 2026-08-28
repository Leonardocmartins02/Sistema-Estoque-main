import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { apiFetch, setAuthToken, setUnauthorizedHandler } from '../api/httpClient';
import { useToast } from '../components/ui/ToastProvider';

const TOKEN_STORAGE_KEY = 'simplestock.auth.token';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const { show: showToast } = useToast();
  // Um 401 costuma chegar em rajada (várias chamadas em voo no mesmo
  // instante) — sem essa trava o usuário veria um toast de expiração por
  // chamada. `login()` rearma para a próxima expiração real.
  const sessionExpiredNotifiedRef = useRef(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // Chamado só quando a sessão cai por um 401 vindo de qualquer chamada de
  // API (token expirado, revogado etc.) — nunca pelo botão "Sair", que chama
  // `logout` direto e não deve anunciar "sessão expirou".
  const handleSessionExpired = useCallback(() => {
    logout();
    if (sessionExpiredNotifiedRef.current) return;
    sessionExpiredNotifiedRef.current = true;
    showToast({ type: 'error', message: 'Sua sessão expirou. Faça login novamente.' });
  }, [logout, showToast]);

  useEffect(() => {
    setUnauthorizedHandler(handleSessionExpired);
    return () => setUnauthorizedHandler(null);
  }, [handleSessionExpired]);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!stored) {
      setStatus('unauthenticated');
      return;
    }
    setAuthToken(stored);
    apiFetch<{ user: AuthUser }>('/auth/me')
      .then(({ user: me }) => {
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        logout();
      });
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(res.token);
    localStorage.setItem(TOKEN_STORAGE_KEY, res.token);
    setUser(res.user);
    setStatus('authenticated');
    sessionExpiredNotifiedRef.current = false;
  }, []);

  const value = useMemo(() => ({ user, status, login, logout }), [user, status, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
