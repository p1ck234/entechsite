import React, { useState } from 'react';
import { X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { uploadAPI, usersAPI } from '../api/client';
import { useTelegram } from '../contexts/TelegramContext';
import ImageWithLoader from './ImageWithLoader';

interface UserModalProps {
  onClose: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ onClose }) => {
  const { isTelegram } = useTelegram();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'USER' as 'ADMIN' | 'USER',
    firstName: '',
    lastName: '',
    middleName: '',
    position: '',
    department: '',
    phone: '',
    telegram: '',
    photo: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');

  const departments = [
    'Отдел IT',
    'Отдел продаж',
    'Отдел финансов',
    'Отдел строительства',
    'Отдел производства',
    'Отдел управления и планирования',
    'Отдел HR',
    'Отдел бухгалтерии',
    'Отдел недвижимости',
    'Отдел проектирования',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      setLoading(false);
      return;
    }

    try {
      await usersAPI.createUser({
        email: formData.email,
        password: formData.password,
        role: formData.role,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || undefined,
        position: formData.position,
        department: formData.department,
        phone: formData.phone,
        telegram: formData.telegram || undefined,
        photo: formData.photo || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при создании пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingPhoto(true);
    setError('');

    try {
      const result = await uploadAPI.uploadPhoto(file);
      setFormData((prev) => ({
        ...prev,
        photo: result.url,
      }));
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Ошибка при загрузке фото');
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({
      ...prev,
      photo: '',
    }));
  };

  return (
    <div className={`fixed inset-0 z-50 ${isTelegram ? '' : 'flex items-center justify-center p-4'}`}>
      {!isTelegram && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      )}
      
      <div className={`${isTelegram ? 'fixed inset-0' : 'relative'} w-full ${isTelegram ? 'h-full max-w-none max-h-none' : 'max-w-2xl max-h-[90vh]'} overflow-y-auto bg-white ${isTelegram ? 'rounded-none' : 'rounded-2xl'}`} style={{ height: isTelegram ? '100vh' : undefined }}>
        <div className={`glass-card ${isTelegram ? 'rounded-none' : 'rounded-2xl'} p-6 ${isTelegram ? 'pb-24' : ''}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              Создать пользователя
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-pastel-400 hover:text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-pastel-700 mb-2">
                  Роль *
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="USER">Пользователь</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-pastel-700 mb-2">
                  Email *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="email@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-pastel-700 mb-2">
                  Пароль *
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pr-10"
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

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-pastel-700 mb-2">
                  Подтвердите пароль *
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input-field pr-10"
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

              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-pastel-700 mb-2">
                  Имя *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Имя"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-pastel-700 mb-2">
                  Фамилия *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Фамилия"
                />
              </div>

              <div>
                <label htmlFor="middleName" className="block text-sm font-medium text-pastel-700 mb-2">
                  Отчество
                </label>
                <input
                  id="middleName"
                  name="middleName"
                  type="text"
                  value={formData.middleName}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Отчество"
                />
              </div>

              <div>
                <label htmlFor="position" className="block text-sm font-medium text-pastel-700 mb-2">
                  Должность *
                </label>
                <input
                  id="position"
                  name="position"
                  type="text"
                  required
                  value={formData.position}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Должность"
                />
              </div>

              <div>
                <label htmlFor="department" className="block text-sm font-medium text-pastel-700 mb-2">
                  Отдел *
                </label>
                <select
                  id="department"
                  name="department"
                  required
                  value={formData.department}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="">Выберите отдел</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-pastel-700 mb-2">
                  Телефон *
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="+7 (999) 123-45-67"
                />
              </div>

              <div>
                <label htmlFor="telegram" className="block text-sm font-medium text-pastel-700 mb-2">
                  Telegram
                </label>
                <input
                  id="telegram"
                  name="telegram"
                  type="text"
                  value={formData.telegram}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="@username"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="photo" className="block text-sm font-medium text-pastel-700 mb-2">
                  Фото
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleUploadPhoto}
                  disabled={uploadingPhoto || loading}
                  className="input-field"
                />
                <p className="text-xs text-pastel-500 mt-1">
                  Фото сохраняется на сервере и стабильно открывается в Mini App.
                </p>
                {uploadingPhoto && (
                  <p className="text-sm text-pastel-500 mt-2">Загрузка фото...</p>
                )}
                {formData.photo && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-pastel-100">
                      <ImageWithLoader
                        src={formData.photo}
                        alt="Фото пользователя"
                        className="w-full h-full object-cover"
                        imageOptions={{
                          width: 160,
                          height: 160,
                          quality: 72,
                          fit: 'cover',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={uploadingPhoto || loading}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Удалить фото из карточки"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={loading || uploadingPhoto}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading || uploadingPhoto}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Создание...' : uploadingPhoto ? 'Загрузка...' : 'Создать пользователя'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserModal;

