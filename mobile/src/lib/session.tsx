import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

/** The member's bearer token lives in the iOS Keychain / Android Keystore, never in plain storage. */
const TOKEN_KEY = 'repcount.token';

type Session = {
  /** undefined while the stored token is being read at startup. */
  token: string | null | undefined;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY).then(setToken, () => setToken(null));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api<{ token: string }>('session', { body: { email, password } });
    await SecureStore.setItemAsync(TOKEN_KEY, result.token);
    setToken(result.token);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, signIn, signOut }), [token, signIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
