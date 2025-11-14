import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { employeesAPI } from '../api/client';
import { Employee, EmployeesResponse } from '../types';
import { Search, Edit, Trash2, Phone, Mail, MessageCircle, UserPlus } from 'lucide-react';
import EmployeeModal from '../components/EmployeeModal';
import UserModal from '../components/UserModal';

const Employees: React.FC = () => {
  const { isAdmin } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const departments = [
    'IT-Отдел', 'Отдел продаж', 'Отдел финансистов', 'Отдел стройки', 'Отдел производства', 'Отдел управления и планирование'
  ];

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response: EmployeesResponse = await employeesAPI.getEmployees({
        page: currentPage,
        limit: 12,
        search: searchTerm || undefined,
        department: selectedDepartment || undefined,
      });
      setEmployees(response.employees);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [currentPage, searchTerm, selectedDepartment]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchEmployees();
  };

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
        {isAdmin && (
          <button
            onClick={() => setShowUserModal(true)}
            className="mt-4 sm:mt-0 btn-primary flex items-center space-x-2"
          >
            <UserPlus className="w-5 h-5" />
            <span>Создать пользователя</span>
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
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
          <button type="submit" className="btn-secondary">
            Найти
          </button>
        </form>
      </div>

      {/* Employees Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {employees.map((employee) => (
            <div key={employee.id} className="card p-6 hover:scale-105 transition-transform">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                  {employee.photo ? (
                    <img
                      src={employee.photo}
                      alt={`${employee.firstName} ${employee.lastName}`}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-pastel-800 truncate">
                    {employee.firstName} {employee.lastName} {employee.middleName}
                  </h3>
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
                  <button
                    onClick={() => handleEdit(employee)}
                    className="p-2 text-pastel-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(employee.id)}
                    className="p-2 text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          onClose={() => {
            setShowUserModal(false);
            fetchEmployees();
          }}
        />
      )}
    </div>
  );
};

export default Employees;
