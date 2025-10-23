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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
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
  }, [isAdmin]);

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
      <div className="glass-card p-6">
        <h1 className="text-3xl font-bold text-pastel-800 mb-2">
          Добро пожаловать, {user?.email}!
        </h1>
        <p className="text-pastel-600">
          {isAdmin 
            ? 'Панель управления компанией и сотрудниками' 
            : 'Ваша персональная панель с курсами и контактами'
          }
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Users className="w-6 h-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-pastel-600">Сотрудники</p>
              <p className="text-2xl font-bold text-pastel-800">{stats.totalEmployees}</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-pastel-600">Курсы</p>
              <p className="text-2xl font-bold text-pastel-800">{stats.totalCourses}</p>
            </div>
          </div>
        </div>

        {!isAdmin && (
          <>
            <div className="glass-card p-6">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-pastel-600">Завершено</p>
                  <p className="text-2xl font-bold text-pastel-800">{stats.completedCourses}</p>
                </div>
              </div>
            </div>

            <div className="glass-card p-6">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-pastel-600">В процессе</p>
                  <p className="text-2xl font-bold text-pastel-800">{stats.inProgressCourses}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-pastel-800 mb-4">Недавние сотрудники</h3>
          <div className="space-y-3">
            {recentEmployees.length > 0 ? (
              recentEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
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
              <p className="text-pastel-500 text-center py-4">Нет сотрудников</p>
            )}
          </div>
        </div>

        {/* Recent Courses */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-pastel-800 mb-4">Недавние курсы</h3>
          <div className="space-y-3">
            {recentCourses.length > 0 ? (
              recentCourses.map((course) => (
                <div key={course.id} className="p-3 bg-white/50 rounded-lg">
                  <h4 className="font-medium text-pastel-800 mb-1">{course.title}</h4>
                  <p className="text-sm text-pastel-600 mb-2">{course.description}</p>
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
              <p className="text-pastel-500 text-center py-4">Нет курсов</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
