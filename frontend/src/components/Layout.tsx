import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Users, 
  BookOpen, 
  Home, 
  User, 
  Menu, 
  X, 
  LogOut,
  Settings
} from 'lucide-react';

const Layout: React.FC = () => {
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  const navigation = [
    { name: 'Главная', href: '/dashboard', icon: Home },
    { name: 'Сотрудники', href: '/employees', icon: Users },
    { name: 'Курсы', href: '/courses', icon: BookOpen },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex h-full flex-col glass-effect">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-white/20">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">E</span>
              </div>
              <span className="text-xl font-bold text-pastel-800">EnTech</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive(item.href)
                      ? 'bg-primary-500/20 text-primary-700 border border-primary-200'
                      : 'text-pastel-600 hover:bg-white/20 hover:text-pastel-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-white/20 p-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">
                  {user?.email.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-pastel-800 truncate">
                  {user?.email}
                </p>
                <p className="text-xs text-pastel-500">
                  {isAdmin ? 'Администратор' : 'Пользователь'}
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <button
                onClick={() => navigate('/profile')}
                className="w-full flex items-center px-4 py-2 text-sm text-pastel-600 hover:bg-white/20 rounded-lg transition-colors"
              >
                <Settings className="w-4 h-4 mr-3" />
                Профиль
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50/20 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-3" />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Top bar */}
        <header className="bg-white/30 backdrop-blur-sm border-b border-white/20 px-4 py-4 lg:px-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <Menu className="w-6 h-6 text-pastel-700" />
            </button>
            
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-pastel-800">
                {navigation.find(item => isActive(item.href))?.name || 'EnTech'}
              </h1>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
