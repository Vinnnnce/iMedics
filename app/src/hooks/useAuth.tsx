/**
 * useAuth Hook — Authentication state management
 * Handles JWT tokens, user state, and persistence.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import * as Keychain from 'react-native-keychain';

export interface AuthUser {
  id: string;
  email: string;
  role: 'PATIENT' | 'DOCTOR' | 'LAB_SCIENTIST' | 'ADMIN';
  name?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (data: { email: string; password: string; role: string; name: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  refreshUser: async () => {},
});

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load stored tokens on app start
  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const credentials = await Keychain.getGenericPassword('imedics_auth');
      if (credentials) {
        const parsed = JSON.parse(credentials.password);
        if (parsed.access_token) {
          // Validate token with /users/me
          const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: { Authorization: `Bearer ${parsed.access_token}` },
          });
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Try refresh
            if (parsed.refresh_token) {
              await refreshAccessToken(parsed.refresh_token);
            }
          }
        }
      }
    } catch (error) {
      // No stored credentials
    } finally {
      setLoading(false);
    }
  };

  const refreshAccessToken = async (refreshToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (response.ok) {
        const data = await response.json();
        await Keychain.setGenericPassword('imedics_auth', JSON.stringify(data));
        setUser(data.user);
      }
    } catch (error) {
      await Keychain.resetGenericPassword('imedics_auth');
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sign in failed');
    }

    const data = await response.json();
    await Keychain.setGenericPassword('imedics_auth', JSON.stringify(data));
    setUser(data.user);
  }, []);

  const signUp = useCallback(async (data: { email: string; password: string; role: string; name: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Sign up failed');
    }

    const result = await response.json();
    await Keychain.setGenericPassword('imedics_auth', JSON.stringify(result));
    setUser(result.user);
  }, []);

  const signOut = useCallback(async () => {
    try {
      const credentials = await Keychain.getGenericPassword('imedics_auth');
      if (credentials) {
        const parsed = JSON.parse(credentials.password);
        if (parsed.refresh_token) {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: parsed.refresh_token }),
          });
        }
      }
    } catch (error) {
      // Ignore errors
    } finally {
      await Keychain.resetGenericPassword('imedics_auth');
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const credentials = await Keychain.getGenericPassword('imedics_auth');
    if (credentials) {
      const parsed = JSON.parse(credentials.password);
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${parsed.access_token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
