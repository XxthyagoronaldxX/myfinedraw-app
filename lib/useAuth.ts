'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, getToken, setToken, User } from './api';

/** Redireciona para /login se não houver sessão válida. */
export function useRequireAuth() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    api<User>('/me')
      .then(setUser)
      .catch(() => router.replace('/login'));
  }, [router]);

  const logout = () => {
    setToken(null);
    router.replace('/login');
  };

  return { user, logout };
}
