import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, XCircle } from 'lucide-react';
import { Employee } from '../types';
import { employeesAPI, uploadAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import ImageWithLoader from './ImageWithLoader';

interface EmployeeModalProps {
  employee: Employee | null;
  onClose: () => void;
}

const EmployeeModal: React.FC<EmployeeModalProps> = ({ employee, onClose }) => {
  const { isAdmin } = useAuth();
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
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const departments = [
    'IT-Отдел', 'Отдел продаж', 'Отдел финансистов', 'Отдел стройки', 'Отдел производства', 'Отдел управления и планирование', 'Отдел поиска персонала'
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
      setPreview(employee.photo || null);
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
      setPreview(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не должен превышать 5MB');
      return;
    }

    // Проверяем тип файла
    if (!file.type.startsWith('image/')) {
      setError('Разрешены только изображения');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Загружаем файл
      const result = await uploadAPI.uploadPhoto(file);
      
      // result.url уже содержит /api/uploads/filename, добавляем только базовый URL
      const photoUrl = result.url.startsWith('http') 
        ? result.url 
        : `${API_BASE_URL}${result.url}`;
      
      setFormData({
        ...formData,
        photo: photoUrl,
      });
      setPreview(photoUrl);
    } catch (err: any) {
      console.error('Upload error:', err);
      const errorMessage = err.response?.data?.message 
        || err.message 
        || 'Ошибка при загрузке файла';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    setFormData({
      ...formData,
      photo: '',
    });
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" 
      style={{ touchAction: 'none', overflow: 'hidden' }}
      onTouchMove={(e) => {
        // Предотвращаем прокрутку фона
        const target = e.target as HTMLElement;
        if (!target.closest('.modal-content')) {
          e.preventDefault();
        }
      }}
    >
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={onClose}
        style={{ touchAction: 'none' }}
      />
      
      <div 
        className="relative w-full max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-t-2xl sm:rounded-2xl modal-content" 
        style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-card rounded-t-2xl sm:rounded-2xl p-6 pb-24 sm:pb-8">
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
                  Фото сотрудника
                </label>
                
                {/* Превью загруженного фото */}
                {preview && (
                  <div className="mb-3 relative inline-block">
                    <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-pastel-200">
                      <ImageWithLoader
                        src={preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Кнопка загрузки файла */}
                <div className="flex items-center space-x-2">
                  <input
                    ref={fileInputRef}
                    id="photo"
                    name="photo"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="photo"
                    className="btn-secondary flex items-center space-x-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploading ? 'Загрузка...' : preview ? 'Изменить фото' : 'Загрузить фото'}</span>
                  </label>
                  {preview && (
                    <span className="text-sm text-pastel-600">Фото загружено</span>
                  )}
                </div>
                <p className="text-xs text-pastel-500 mt-1">
                  Разрешены форматы: JPG, PNG, GIF, WEBP. Максимальный размер: 5MB
                </p>
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
                disabled={loading}
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Сохранение...' : (employee ? 'Обновить' : 'Создать')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeModal;
