import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { employeesAPI, coursesAPI } from '../api/client';
import { Users, BookOpen, TrendingUp, Clock } from 'lucide-react';
import { Employee, Course } from '../types';

const Dashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalCourses: 0,
    completedCourses: 0,
    inProgressCourses: 0,
  });
  const [recentEmployees, setRecentEmployees] = useState<Employee[]>([]);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch current employee info
        try {
          const employee = await employeesAPI.getCurrentEmployee();
          if (employee) {
            setCurrentEmployee(employee);
          }
        } catch (error) {
          // Employee not found is OK, will show email as fallback
          console.error('Error fetching current employee:', error);
        }

        // Fetch employees
        const employeesResponse = await employeesAPI.getEmployees({ limit: 5 });
        setRecentEmployees(employeesResponse.employees);
        setStats(prev => ({ ...prev, totalEmployees: employeesResponse.pagination.total }));

        // Fetch courses
        const coursesResponse = await coursesAPI.getCourses({ limit: 5 });
        setRecentCourses(coursesResponse.courses);
        setStats(prev => ({ ...prev, totalCourses: coursesResponse.pagination.total }));

        // Fetch user progress if not admin
        if (!isAdmin) {
          const progressResponse = await coursesAPI.getUserProgress();
          const completed = progressResponse.progress.filter(p => p.completed).length;
          const inProgress = progressResponse.progress.filter(p => !p.completed && p.progress > 0).length;
          setStats(prev => ({ 
            ...prev, 
            completedCourses: completed,
            inProgressCourses: inProgress 
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set some default data to prevent blank screen
        setStats({
          totalEmployees: 0,
          totalCourses: 0,
          completedCourses: 0,
          inProgressCourses: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isAdmin, user?.email]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="glass-card p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-pastel-800 mb-2">
          Добро пожаловать, {currentEmployee 
            ? `${currentEmployee.lastName || ''} ${currentEmployee.firstName || ''}`.trim() 
            : user?.email || 'Пользователь'}!
        </h1>
        <p className="text-pastel-600 text-sm sm:text-base">
          {isAdmin 
            ? 'Панель управления компанией и сотрудниками' 
            : 'Ваша персональная панель с курсами и контактами'
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-primary-100 rounded-lg flex-shrink-0">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
            </div>
            <div className="ml-3 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-pastel-600">Сотрудники</p>
              <p className="text-xl sm:text-2xl font-bold text-pastel-800">{stats.totalEmployees}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 sm:p-6">
          <div className="flex items-center">
            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg flex-shrink-0">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="ml-3 sm:ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-pastel-600">Курсы</p>
              <p className="text-xl sm:text-2xl font-bold text-pastel-800">{stats.totalCourses}</p>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <>
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-green-100 rounded-lg flex-shrink-0">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-pastel-600">Завершено</p>
                  <p className="text-xl sm:text-2xl font-bold text-pastel-800">{stats.completedCourses}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center">
                <div className="p-2 sm:p-3 bg-yellow-100 rounded-lg flex-shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600" />
                </div>
                <div className="ml-3 sm:ml-4 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-pastel-600">В процессе</p>
                  <p className="text-xl sm:text-2xl font-bold text-pastel-800">{stats.inProgressCourses}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Employees */}
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-pastel-800 mb-4">Недавние сотрудники</h3>
          <div className="space-y-3">
            {recentEmployees.length > 0 ? (
              recentEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-medium text-sm">
                      {employee.firstName?.charAt(0) || '?'}{employee.lastName?.charAt(0) || '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pastel-800 truncate">
                      {employee.firstName || 'Имя'} {employee.lastName || 'Фамилия'}
                    </p>
                    <p className="text-xs text-pastel-600 truncate">{employee.position}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-pastel-500 text-center py-4 text-sm">Нет сотрудников</p>
            )}
          </div>
        </div>

        {/* Recent Courses */}
        <div className="glass-card p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-pastel-800 mb-4">Недавние курсы</h3>
          <div className="space-y-3">
            {recentCourses.length > 0 ? (
              recentCourses.map((course) => (
                <div key={course.id} className="p-3 bg-white/50 rounded-lg">
                  <h4 className="font-medium text-pastel-800 mb-1 text-sm sm:text-base">{course.title}</h4>
                  <p className="text-xs sm:text-sm text-pastel-600 mb-2 line-clamp-2">{course.description}</p>
                  {course.userProgress && (
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-pastel-200 rounded-full h-2">
                        <div 
                          className="bg-primary-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${course.userProgress.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-pastel-600">
                        {course.userProgress.progress}%
                      </span>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-pastel-500 text-center py-4 text-sm">Нет курсов</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
