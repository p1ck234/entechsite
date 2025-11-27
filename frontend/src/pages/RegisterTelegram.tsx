import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '../contexts/TelegramContext';
import { authAPI } from '../api/client';
import Logo from '../components/Logo';
import { User, Briefcase, Building2, Phone } from 'lucide-react';

const RegisterTelegram: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { isTelegram, initData, user: telegramUser } = useTelegram();
  const navigate = useNavigate();

  // Заполняем данные из Telegram если есть
  React.useEffect(() => {
    if (telegramUser) {
      setFormData(prev => ({
        ...prev,
        firstName: prev.firstName || telegramUser.first_name || '',
        lastName: prev.lastName || telegramUser.last_name || '',
      }));
    }
  }, [telegramUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!isTelegram || !initData) {
      setError('Эта форма доступна только в Telegram Mini App');
      setLoading(false);
      return;
    }

    if (!formData.firstName || !formData.lastName) {
      setError('Заполните имя и фамилию');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.registerTelegram(
        initData,
        formData.firstName,
        formData.lastName,
        formData.position,
        formData.department,
        formData.phone
      );

      if (response.approved) {
        // Первый пользователь - сразу авторизован
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        navigate('/home');
      } else {
        // Заявка отправлена, ждем подтверждения
        navigate('/login', { 
          state: { 
            message: 'Заявка на регистрацию отправлена. Ожидайте подтверждения администратора.' 
          } 
        });
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const errorMessage = err.response?.data?.message 
        || err.response?.data?.error 
        || err.message 
        || 'Ошибка при регистрации';
      
      // Показываем детальную информацию об ошибке
      let detailedError = errorMessage;
      if (err.response?.data) {
        if (err.response.data.errors) {
          detailedError = err.response.data.errors.map((e: any) => e.msg || e.message).join(', ');
        } else if (err.response.data.error) {
          detailedError = `${errorMessage}: ${err.response.data.error}`;
        }
      }
      
      setError(detailedError);
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

  if (!isTelegram) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg p-4">
        <div className="text-center">
          <p className="text-pastel-600">Эта страница доступна только в Telegram Mini App</p>
        </div>
      </div>
    );
  }

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

          <form onSubmit={handleSubmit} className="space-y-6">
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
                    value={formData.firstName}
                    onChange={handleChange}
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
                    value={formData.lastName}
                    onChange={handleChange}
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
                  value={formData.position}
                  onChange={handleChange}
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
                  value={formData.department}
                  onChange={handleChange}
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
                  value={formData.phone}
                  onChange={handleChange}
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
};

export default RegisterTelegram;

