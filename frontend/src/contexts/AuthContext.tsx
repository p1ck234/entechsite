import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import { authAPI } from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginTelegram: (initData: string) => Promise<AuthResponse>;
  syncTelegramAuth: (initData: string) => Promise<boolean>;
  syncTelegramOAuth: () => Promise<boolean>;
  register: (email: string, password: string, telegramUsername: string, firstName: string, lastName: string, position?: string, department?: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const TELEGRAM_OAUTH_STORAGE_KEY = 'telegramOAuthData';

type TelegramOAuthPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!user && !!token;
  const isAdmin = user?.role === 'ADMIN';

  const getStoredTelegramOAuthData = useCallback((): TelegramOAuthPayload | null => {
    const raw = localStorage.getItem(TELEGRAM_OAUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as TelegramOAuthPayload;
      if (
        typeof parsed?.id !== 'number' ||
        typeof parsed?.first_name !== 'string' ||
        typeof parsed?.auth_date !== 'number' ||
        typeof parsed?.hash !== 'string'
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          // Verify token is still valid
          const response = await authAPI.getCurrentUser();
          setUser(response.user);
        } catch (error) {
          // Token is invalid, clear storage
          console.log('Token invalid, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { user, token } = response;

      setUser(user);
      setToken(token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка входа');
    }
  };

  const loginTelegram = async (initData: string) => {
    try {
      const response = await authAPI.loginTelegram(initData);
      const { user, token } = response;

      setUser(user);
      setToken(token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      // Возвращаем полный ответ для обработки isNewUser
      return response;
    } catch (error: any) {
      // Если заявка на регистрацию создана автоматически - возвращаем специальную ошибку
      if (error.response?.status === 403 && 
          (error.response?.data?.needsRegistration || 
           error.response?.data?.status === 'PENDING')) {
        // Заявка создана автоматически - показываем сообщение от сервера
        const serverMessage = error.response?.data?.message || 
          'Ваша заявка на регистрацию отправлена. Ожидайте подтверждения администратора.';
        const customError: any = new Error(serverMessage);
        customError.needsRegistration = true;
        customError.status = 'PENDING';
        customError.registrationId = error.response?.data?.registrationId;
        throw customError;
      }
      
      const errorMessage = error.response?.data?.message || 'Ошибка входа через Telegram';
      throw new Error(errorMessage);
    }
  };

  const syncTelegramAuth = useCallback(async (initData: string): Promise<boolean> => {
    if (!initData) {
      return false;
    }

    try {
      const response = await authAPI.loginTelegram(initData);
      const { user, token } = response;

      setUser(user);
      setToken(token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return true;
    } catch (error: any) {
      // Для фоновой синхронизации не выбрасываем ошибку:
      // пользователь остается в текущей сессии, повторим на следующем цикле.
      console.warn('Telegram background sync skipped:', {
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message
      });
      return false;
    }
  }, []);

  const syncTelegramOAuth = useCallback(async (): Promise<boolean> => {
    const payload = getStoredTelegramOAuthData();
    if (!payload) {
      return false;
    }

    try {
      const { username: _username, photo_url: _photoUrl, ...syncPayload } = payload;
      const response = await authAPI.loginTelegramOAuth(syncPayload);
      const { user, token } = response;

      setUser(user);
      setToken(token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      return true;
    } catch (error: any) {
      console.warn('Telegram OAuth background sync skipped:', {
        status: error?.response?.status,
        message: error?.response?.data?.message || error?.message
      });
      return false;
    }
  }, [getStoredTelegramOAuthData]);

  const register = async (email: string, password: string, telegramUsername: string, firstName: string, lastName: string, position?: string, department?: string) => {
    try {
      const response = await authAPI.register(email, password, telegramUsername, firstName, lastName, position, department);
      const { user, token } = response;

      setUser(user);
      setToken(token);
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Ошибка регистрации');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem(TELEGRAM_OAUTH_STORAGE_KEY);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    loginTelegram,
    syncTelegramAuth,
    syncTelegramOAuth,
    register,
    logout,
    loading,
    isAuthenticated,
    isAdmin,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
