import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, User } from 'lucide-react';
import { employeesAPI } from '../api/client';
import type { Employee } from '../types';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentEmployee = async () => {
      try {
        const employee = await employeesAPI.getCurrentEmployee();
        if (isMounted && employee) {
          setCurrentEmployee(employee);
        }
      } catch (error) {
        console.error('Error fetching current employee in Profile:', error);
        if (isMounted) {
          setCurrentEmployee(null);
        }
      }
    };

    fetchCurrentEmployee();

    return () => {
      isMounted = false;
    };
  }, []);

  const displayName = currentEmployee
    ? `${currentEmployee.lastName || ''} ${currentEmployee.firstName || ''}`.trim() || user?.email
    : user?.email;

  const initials = currentEmployee
    ? `${(currentEmployee.firstName || currentEmployee.lastName || '?').charAt(0).toUpperCase()}`
    : `${user?.email.charAt(0).toUpperCase()}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-pastel-800">Профиль</h1>
        <p className="text-pastel-600 mt-1">Управление вашим аккаунтом</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* User Info */}
        <div className="glass-card p-6">
          <h2 className="text-xl font-semibold text-pastel-800 mb-6">Информация о пользователе</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {initials}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-medium text-pastel-800">
                  {displayName}
                </h3>
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
      </div>

      {/* Additional Info */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-pastel-800 mb-4">Дополнительная информация</h2>
        <div className="text-sm text-pastel-600">
          <span className="font-medium">Роль в системе:</span>
          <p>{user?.role === 'ADMIN' ? 'Администратор' : 'Пользователь'}</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
