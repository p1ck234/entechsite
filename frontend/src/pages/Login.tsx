import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, loginTelegram } = useAuth();
  const { isTelegram, initData } = useTelegram();
  const navigate = useNavigate();

  // Автоматическая авторизация через Telegram
  useEffect(() => {
    if (isTelegram && initData) {
      const handleTelegramLogin = async () => {
        try {
          setLoading(true);
          await loginTelegram(initData);
          navigate('/home');
        } catch (err: any) {
          setError(err.message || 'Ошибка авторизации через Telegram');
          setLoading(false);
        }
      };
      handleTelegramLogin();
    }
  }, [isTelegram, initData, loginTelegram, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(formData.email, formData.password);
      navigate('/home');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Если это Telegram, показываем загрузку
  if (isTelegram && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-pastel-600">Авторизация через Telegram...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <p className="text-pastel-600">
            {isTelegram ? 'Вход через Telegram' : 'Войдите в систему управления компанией'}
          </p>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-pastel-800 mb-6 text-center">
            Вход в систему
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-pastel-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="your@email.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-pastel-700 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pastel-400 hover:text-pastel-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-pastel-600 text-sm">
              Для получения доступа обратитесь к администратору
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
