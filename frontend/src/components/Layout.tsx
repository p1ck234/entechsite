import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import { SITE_CONFIG } from '../config/site';
import { 
  Users, 
  BookOpen, 
  Home, 
  LayoutDashboard,
  Menu, 
  LogOut,
  Settings,
  Heart,
  Calendar
} from 'lucide-react';
import Logo from './Logo';

const Layout: React.FC = () => {
  const { user, logout, isAdmin, isAuthenticated } = useAuth();
  const { isTelegram, webApp } = useTelegram();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Обработка кнопки "Назад" в Telegram
  useEffect(() => {
    if (!isTelegram || !webApp) return;

    const handleBackButton = () => {
      if (location.pathname === '/home' || location.pathname === '/dashboard') {
        // Если на главной странице, закрываем приложение
        webApp.close();
      } else {
        // Иначе возвращаемся назад
        navigate(-1);
      }
    };

    // Показываем кнопку "Назад" если не на главной странице
    if (location.pathname !== '/home' && location.pathname !== '/dashboard') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBackButton);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      webApp.BackButton.offClick(handleBackButton);
    };
  }, [isTelegram, webApp, location.pathname, navigate]);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  const navigation = [
    { name: 'Главная', href: '/home', icon: Home },
    { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Адресная книга', href: '/employees', icon: Users },
    { name: 'База знаний', href: '/courses', icon: BookOpen },
    { name: 'Наша жизнь', href: '/life', icon: Heart },
    { name: 'Календарь мероприятий', href: '/events', icon: Calendar },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={`min-h-screen flex ${isTelegram ? 'flex-col' : ''}`}>
      {/* Mobile sidebar overlay */}
      {!isTelegram && sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      {/* Sidebar - скрываем в Telegram, используем bottom navigation */}
      {!isTelegram && (
        <div className={`
          fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
        <div className="flex h-full flex-col glass-effect">
          {/* Logo */}
          <div className="flex h-16 items-center justify-center border-b border-white/20 px-4">
            <Logo size="md" />
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
                    w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap
                    ${isActive(item.href)
                      ? 'bg-primary-500/20 text-primary-700 border border-primary-200'
                      : 'text-pastel-600 hover:bg-white/20 hover:text-pastel-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
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
      )}

      {/* Main content */}
      <div className={`flex-1 flex flex-col ${isTelegram ? '' : 'lg:ml-0'} ${isTelegram && location.pathname === '/home' ? 'relative h-full' : ''}`}>
        {/* Top bar - скрываем в Telegram */}
        {!isTelegram && (
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
                  {navigation.find(item => isActive(item.href))?.name || SITE_CONFIG.name}
                </h1>
              </div>
            </div>
          </header>
        )}

        {/* Page content */}
        <main className={`flex-1 ${isTelegram && location.pathname === '/home' ? 'p-0 pb-0 relative h-full overflow-hidden' : isTelegram ? 'p-4 pb-20' : 'p-4 lg:p-6'}`}>
          <Outlet />
        </main>
      </div>

      {/* Bottom Navigation для Telegram */}
      {isTelegram && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-pastel-200 z-50 safe-area-inset-bottom">
          <div className="flex justify-around items-center h-16 overflow-x-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              // Сокращаем длинные названия для мобильных
              const shortName = item.name.length > 12 
                ? item.name.split(' ').map(w => w[0]).join('') 
                : item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={`
                    flex flex-col items-center justify-center flex-1 min-w-[60px] h-full transition-colors px-1
                    ${isActive(item.href)
                      ? 'text-primary-600'
                      : 'text-pastel-600'
                    }
                  `}
                  title={item.name}
                >
                  <Icon className="w-5 h-5 mb-0.5 flex-shrink-0" />
                  <span className="text-[10px] leading-tight text-center">{shortName}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
