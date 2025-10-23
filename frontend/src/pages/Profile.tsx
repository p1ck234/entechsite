import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail, User, Save } from 'lucide-react';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Новые пароли не совпадают');
      setLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('Новый пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    try {
      // Here you would call the API to change password
      // await authAPI.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      
      setSuccess('Пароль успешно изменен');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при изменении пароля');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-pastel-800">Профиль</h1>
        <p className="text-pastel-600 mt-1">Управление вашим аккаунтом</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Info */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-pastel-800 mb-6">Информация о пользователе</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {user?.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-pastel-800">{user?.email}</h3>
                <p className="text-pastel-600">
                  {user?.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-pastel-600">
                <Mail className="w-5 h-5" />
                <span>{user?.email}</span>
              </div>
              
              <div className="flex items-center space-x-3 text-pastel-600">
                <User className="w-5 h-5" />
                <span>
                  {user?.role === 'ADMIN' ? 'Администратор' : 'Обычный пользователь'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-pastel-800 mb-6">Изменить пароль</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              {success}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-pastel-700 mb-2">
                Текущий пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                <input
                  id="currentPassword"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pastel-400 hover:text-pastel-600"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-pastel-700 mb-2">
                Новый пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                <input
                  id="newPassword"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pastel-400 hover:text-pastel-600"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-pastel-700 mb-2">
                Подтвердите новый пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-pastel-400 hover:text-pastel-600"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              <span>{loading ? 'Сохранение...' : 'Изменить пароль'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Additional Info */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-pastel-800 mb-4">Дополнительная информация</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-pastel-600">
          <div>
            <span className="font-medium">Дата регистрации:</span>
            <p>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : 'Неизвестно'}</p>
          </div>
          <div>
            <span className="font-medium">Роль в системе:</span>
            <p>{user?.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
