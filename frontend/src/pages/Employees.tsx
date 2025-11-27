import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { employeesAPI } from '../api/client';
import { Employee, EmployeesResponse } from '../types';
import { Search, Edit, Trash2, Phone, Mail, MessageCircle, UserPlus, RotateCcw, Lock, CheckCircle, XCircle, Clock } from 'lucide-react';
import EmployeeModal from '../components/EmployeeModal';
import UserModal from '../components/UserModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import ImageWithLoader from '../components/ImageWithLoader';

const Employees: React.FC = () => {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'active' | 'pending' | 'rejected'>('active');

  // Ensure showInactive is always false for non-admin users
  useEffect(() => {
    if (!isAdmin && showInactive) {
      setShowInactive(false);
    }
  }, [isAdmin, showInactive]);

  const departments = [
    'IT-Отдел', 'Отдел продаж', 'Отдел финансистов', 'Отдел стройки', 'Отдел производства', 'Отдел управления и планирование'
  ];

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      // Преобразуем статус фильтр в формат, который ожидает backend
      let statusParam: 'APPROVED' | 'PENDING' | 'REJECTED' | undefined;
      if (statusFilter === 'active') {
        statusParam = 'APPROVED';
      } else if (statusFilter === 'pending') {
        statusParam = 'PENDING';
      } else if (statusFilter === 'rejected') {
        statusParam = 'REJECTED';
      }
      
      const response: EmployeesResponse = await employeesAPI.getEmployees({
        page: currentPage,
        limit: 12,
        search: searchTerm || undefined,
        department: selectedDepartment || undefined,
        showInactive: isAdmin && showInactive,
        status: statusParam,
      });
      setEmployees(response.employees);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedDepartment, showInactive, statusFilter]);

  // Fetch employees with debounce for search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchEmployees();
    }, searchTerm ? 300 : 0); // 300ms delay for search, immediate for other filters

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, selectedDepartment, showInactive, statusFilter]);


  const handleDelete = async (id: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      try {
        await employeesAPI.deleteEmployee(id);
        fetchEmployees();
      } catch (error) {
        console.error('Error deleting employee:', error);
      }
    }
  };

  const handleRestore = async (id: string) => {
    if (!isAdmin) return;
    
    if (window.confirm('Вы уверены, что хотите восстановить этого сотрудника?')) {
      try {
        await employeesAPI.updateEmployee(id, { isActive: true });
        fetchEmployees();
      } catch (error) {
        console.error('Error restoring employee:', error);
      }
    }
  };

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingEmployee(null);
    fetchEmployees();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-pastel-800">Сотрудники</h1>
          <p className="text-pastel-600 mt-1">Адресная книга компании</p>
        </div>
        {/* Кнопка создания пользователя убрана - теперь регистрация только через Telegram */}
      </div>

      {/* Filters */}
      <div className="glass-card p-6 space-y-4">
        {isAdmin && (
          <div className="flex items-center space-x-4 pb-4 border-b border-pastel-200">
            <button
              onClick={() => {
                setStatusFilter('active');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                statusFilter === 'active'
                  ? 'bg-primary-500 text-white'
                  : 'bg-pastel-100 text-pastel-700 hover:bg-pastel-200'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Активные</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('pending');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                statusFilter === 'pending'
                  ? 'bg-primary-500 text-white'
                  : 'bg-pastel-100 text-pastel-700 hover:bg-pastel-200'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>На согласовании</span>
            </button>
            <button
              onClick={() => {
                setStatusFilter('rejected');
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 ${
                statusFilter === 'rejected'
                  ? 'bg-primary-500 text-white'
                  : 'bg-pastel-100 text-pastel-700 hover:bg-pastel-200'
              }`}
            >
              <XCircle className="w-4 h-4" />
              <span>Удаленные</span>
            </button>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-pastel-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск по имени, должности или email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="input-field sm:w-48"
          >
            <option value="">Все отделы</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Employees Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <div 
              key={employee.id} 
              className={`card p-6 hover:scale-105 transition-transform ${
                !employee.isActive ? 'opacity-60 border-2 border-red-200' : ''
              }`}
            >
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {employee.photo ? (
                    <ImageWithLoader
                      src={employee.photo}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {employee.firstName?.charAt(0) || '?'}{employee.lastName?.charAt(0) || '?'}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="text-lg font-semibold text-pastel-800 truncate">
                      {employee.firstName} {employee.lastName} {employee.middleName}
                    </h3>
                    {employee.status === 'PENDING' && (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">
                        На согласовании
                      </span>
                    )}
                    {employee.status === 'REJECTED' && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">
                        Отклонен
                      </span>
                    )}
                    {!employee.isActive && employee.status === 'APPROVED' && (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded">
                        Неактивен
                      </span>
                    )}
                  </div>
                  <p className="text-pastel-600 text-sm mb-1">{employee.position}</p>
                  <p className="text-pastel-500 text-xs mb-1">{employee.department}</p>
                  {employee.userRole === 'ADMIN' && (
                    <p className="text-primary-600 text-xs font-semibold mb-3">Менеджер</p>
                  )}
                  {!employee.userRole && (
                    <p className="text-pastel-400 text-xs mb-3">Не зарегистрирован</p>
                  )}
                  {employee.userRole === 'USER' && (
                    <p className="text-pastel-500 text-xs mb-3">Пользователь</p>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm text-pastel-600">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{employee.email}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-pastel-600">
                      <Phone className="w-4 h-4" />
                      <span>{employee.phone}</span>
                    </div>
                    {employee.telegram && (
                      <div className="flex items-center space-x-2 text-sm text-pastel-600">
                        <MessageCircle className="w-4 h-4" />
                        <a
                          href={`https://t.me/${employee.telegram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:text-primary-700 hover:underline transition-colors"
                        >
                          {employee.telegram}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {isAdmin && (
                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t border-pastel-200">
                  {employee.status === 'PENDING' ? (
                    // Кнопки для заявок на согласовании
                    <>
                      <button
                        onClick={() => handleApprove(employee.id)}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                        title="Одобрить"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReject(employee.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        title="Отклонить"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  ) : !employee.isActive ? (
                    <button
                      onClick={() => handleRestore(employee.id)}
                      className="p-2 text-pastel-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title="Восстановить"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  ) : (
                    <>
                      {employee.userRole && (
                        <button
                          onClick={() => {
                            setPasswordEmployee(employee);
                            setShowPasswordModal(true);
                          }}
                          className="p-2 text-pastel-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Изменить пароль"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(employee)}
                        className="p-2 text-pastel-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(employee.id)}
                        className="p-2 text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center space-x-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Назад
          </button>
          <span className="flex items-center px-4 py-2 text-pastel-600">
            Страница {currentPage} из {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Вперед
          </button>
        </div>
      )}

      {/* Employee Modal - only for editing */}
      {showModal && editingEmployee && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={handleModalClose}
        />
      )}

      {/* User Modal убран - регистрация только через Telegram */}

      {/* Change Password Modal */}
      {showPasswordModal && passwordEmployee && (
        <ChangePasswordModal
          employeeEmail={passwordEmployee.email}
          employeeName={`${passwordEmployee.firstName} ${passwordEmployee.lastName}`}
          onClose={() => {
            setShowPasswordModal(false);
            setPasswordEmployee(null);
          }}
          onSuccess={() => {
            // Optionally show success message or refresh data
          }}
        />
      )}
    </div>
  );
};

export default Employees;
