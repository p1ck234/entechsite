import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import { authAPI } from '../api/client';
import Logo from '../components/Logo';
import { User, Briefcase, Building2, Phone } from 'lucide-react';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    phone: '',
  });

  const { loginTelegram } = useAuth();
  const { isTelegram, initData, user: telegramUser } = useTelegram();
  const navigate = useNavigate();

  // Заполняем данные из Telegram если есть
  useEffect(() => {
    if (telegramUser && showRegistration) {
      setRegistrationData(prev => ({
        ...prev,
        firstName: prev.firstName || telegramUser.first_name || '',
        lastName: prev.lastName || telegramUser.last_name || '',
      }));
    }
  }, [telegramUser, showRegistration]);

  // Автоматическая авторизация через Telegram
  useEffect(() => {
    if (isTelegram && initData && !showRegistration) {
      const handleTelegramLogin = async () => {
        try {
          setLoading(true);
          setError('');
          await loginTelegram(initData);
          navigate('/home');
        } catch (err: any) {
          // Если нужна регистрация - показываем форму регистрации
          if (err.response?.data?.needsRegistration || 
              (err.response?.status === 403 && err.response?.data?.message?.includes('не зарегистрирован'))) {
            setShowRegistration(true);
            setLoading(false);
            return;
          }
          // Если заявка ожидает подтверждения
          if (err.response?.status === 403 && err.response?.data?.status === 'PENDING') {
            setError('Ваша заявка на регистрацию ожидает подтверждения администратора.');
            setLoading(false);
            return;
          }
          setError(err.message || 'Ошибка авторизации через Telegram');
          setLoading(false);
        }
      };
      handleTelegramLogin();
    }
  }, [isTelegram, initData, loginTelegram, navigate, showRegistration]);

  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isTelegram || !initData) {
      setError('Эта форма доступна только в Telegram Mini App');
      setLoading(false);
      return;
    }

    if (!registrationData.firstName || !registrationData.lastName) {
      setError('Заполните имя и фамилию');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.registerTelegram(
        initData,
        registrationData.firstName,
        registrationData.lastName,
        registrationData.position,
        registrationData.department,
        registrationData.phone
      );

      if (response.approved) {
        // Первый пользователь - сразу авторизован
        localStorage.setItem('token', response.token!);
        localStorage.setItem('user', JSON.stringify(response.user));
        navigate('/home');
      } else {
        // Заявка отправлена
        setError('');
        setShowRegistration(false);
        setLoading(false);
        alert('Заявка на регистрацию отправлена. Ожидайте подтверждения администратора.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Ошибка при регистрации';
      
      let detailedError = errorMessage;
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        detailedError = err.response.data.errors.map((e: any) => e.msg || e.message || e).join(', ');
      }
      
      setError(detailedError);
      setLoading(false);
    }
  };

  const handleRegistrationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistrationData({
      ...registrationData,
      [e.target.name]: e.target.value,
    });
  };

  // Если это Telegram, показываем загрузку или форму
  if (isTelegram) {
    if (loading && !showRegistration) {
      return (
        <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-pastel-600">Авторизация через Telegram...</p>
          </div>
        </div>
      );
    }

    // Если нужно зарегистрироваться - показываем форму регистрации
    if (showRegistration) {
      return (
        <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <Logo size="lg" />
              </div>
              <p className="text-pastel-600">Регистрация в системе</p>
            </div>

            <div className="glass-card rounded-2xl p-8 shadow-2xl">
              <h2 className="text-2xl font-bold text-pastel-800 mb-6 text-center">
                Заполните данные
              </h2>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-700 font-semibold mb-1">Ошибка:</p>
                  <p className="text-red-600 text-sm whitespace-pre-wrap break-words">{error}</p>
                </div>
              )}

              <form onSubmit={handleRegistration} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-pastel-700 mb-2">
                      Имя *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                      <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        required
                        value={registrationData.firstName}
                        onChange={handleRegistrationChange}
                        className="input-field pl-10"
                        placeholder="Иван"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-pastel-700 mb-2">
                      Фамилия *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                      <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        required
                        value={registrationData.lastName}
                        onChange={handleRegistrationChange}
                        className="input-field pl-10"
                        placeholder="Иванов"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="position" className="block text-sm font-medium text-pastel-700 mb-2">
                    Должность
                  </label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                    <input
                      id="position"
                      name="position"
                      type="text"
                      value={registrationData.position}
                      onChange={handleRegistrationChange}
                      className="input-field pl-10"
                      placeholder="Сотрудник"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-pastel-700 mb-2">
                    Отдел
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                    <input
                      id="department"
                      name="department"
                      type="text"
                      value={registrationData.department}
                      onChange={handleRegistrationChange}
                      className="input-field pl-10"
                      placeholder="Общий отдел"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-pastel-700 mb-2">
                    Телефон
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={registrationData.phone}
                      onChange={handleRegistrationChange}
                      className="input-field pl-10"
                      placeholder="+7 (999) 123-45-67"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Отправка...' : 'Отправить заявку'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-pastel-600 text-sm">
                  После отправки заявки администратор рассмотрит её и подтвердит ваш доступ
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Если ошибка авторизации (не регистрация)
    if (error && !showRegistration) {
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
