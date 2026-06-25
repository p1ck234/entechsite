import React, { useState, useEffect } from 'react';
import { Trash2, X } from 'lucide-react';
import { Employee } from '../types';
import { employeesAPI, uploadAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import ImageWithLoader from './ImageWithLoader';

interface EmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onClose }) => {
  const { isAdmin } = useAuth();
  const { isTelegram } = useTelegram();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    position: '',
    department: '',
    email: '',
    phone: '',
    telegram: '',
    photo: '',
    role: 'USER' as 'ADMIN' | 'USER',
  });
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

  useEffect(() => {
    if (employee) {
      setFormData({
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName || '',
        position: employee.position,
        department: employee.department,
        email: employee.email,
        phone: employee.phone,
        telegram: employee.telegram || '',
        photo: employee.photo || '',
        role: (employee.userRole as 'ADMIN' | 'USER') || 'USER',
      });
    } else {
      setFormData({
        firstName: '',
        lastName: '',
        middleName: '',
        position: '',
        department: '',
        email: '',
        phone: '',
        telegram: '',
        photo: '',
        role: 'USER',
      });
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (employee) {
        await employeesAPI.updateEmployee(employee.id, formData);
      } else {
        await employeesAPI.createEmployee({ ...formData, isActive: true });
      }
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка при сохранении');
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

  // Блокируем прокрутку body при открытом попапе
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-50 ${isTelegram ? '' : 'flex items-end sm:items-center justify-center p-0 sm:p-4'}`}
      style={isTelegram ? {} : { touchAction: 'none', overflow: 'hidden' }}
      onTouchMove={isTelegram ? undefined : (e) => {
        // Предотвращаем прокрутку фона
        const target = e.target as HTMLElement;
        if (!target.closest('.modal-content')) {
          e.preventDefault();
        }
      }}
    >
      {!isTelegram && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
          onClick={onClose}
          style={{ touchAction: 'none' }}
        />
      )}
      
      <div 
        className={`${isTelegram ? 'fixed inset-0' : 'relative'} w-full ${isTelegram ? 'h-full max-w-none max-h-none' : 'max-w-2xl max-h-[85vh] sm:max-h-[90vh]'} overflow-y-auto bg-white ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} modal-content`}
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', height: isTelegram ? '100vh' : undefined }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`glass-card ${isTelegram ? 'rounded-none' : 'rounded-t-2xl sm:rounded-2xl'} p-6 ${isTelegram ? 'pb-24' : 'pb-24 sm:pb-8'}`}>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-pastel-800">
              {employee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
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
                        alt="Фото сотрудника"
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

              {isAdmin && employee && employee.userRole && (
                <div className="md:col-span-2">
                  <label htmlFor="role" className="block text-sm font-medium text-pastel-700 mb-2">
                    Роль пользователя
                  </label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="USER">Пользователь</option>
                    <option value="ADMIN">Администратор</option>
                  </select>
                  <p className="text-xs text-pastel-500 mt-1">
                    Изменение роли повлияет на права доступа пользователя в системе
                  </p>
                </div>
              )}
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
                {loading ? 'Сохранение...' : uploadingPhoto ? 'Загрузка...' : (employee ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
