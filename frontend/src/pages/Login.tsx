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
  if (isTelegram) {
    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-pastel-600">Авторизация через Telegram...</p>
          </div>
        </div>
      );
    }

    // Если ошибка в Telegram
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
          <div className="w-full max-w-md">
            <div className="glass-card rounded-2xl p-8 shadow-2xl text-center">
              <div className="mb-4">
                <Logo size="lg" />
              </div>
              <h2 className="text-2xl font-bold text-pastel-800 mb-4">
                Ошибка авторизации
              </h2>
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
              <p className="text-pastel-600 text-sm">
                Обратитесь к администратору для добавления в систему
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  // Если не Telegram - показываем сообщение
  if (!isTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl p-8 shadow-2xl text-center">
            <div className="mb-4">
              <Logo size="lg" />
            </div>
            <h2 className="text-2xl font-bold text-pastel-800 mb-4">
              Вход только через Telegram
            </h2>
            <p className="text-pastel-600 mb-6">
              Для входа в систему откройте приложение через Telegram бота
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
              <p className="font-semibold mb-2">Как войти:</p>
              <ol className="list-decimal list-inside space-y-1 text-left">
                <li>Откройте Telegram бота</li>
                <li>Нажмите на кнопку меню или Mini App</li>
                <li>Авторизация произойдет автоматически</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (не должно доходить сюда)
  return null;
};

export default Login;
