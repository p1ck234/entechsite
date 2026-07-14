import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import { SITE_CONFIG } from '../config/site';
import { employeesAPI, supportAPI } from '../api/client';
import type { Employee } from '../types';
import {
  Users,
  BookOpen,
  Home,
  Menu,
  LogOut,
  Heart,
  Calendar,
  Bot,
  DoorOpen,
  Network,
  Headphones,
  Shield,
  Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Logo from './Logo';

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  shadowOnly?: boolean;
}

const TELEGRAM_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const TELEGRAM_OAUTH_STORAGE_KEY = 'telegramOAuthData';

const Layout: React.FC = () => {
  const { user, logout, isAdmin, isAuthenticated, syncTelegramAuth, syncTelegramOAuth } = useAuth();
  const { isTelegram, webApp, initData } = useTelegram();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentEmployee, setCurrentEmployee] = useState<Employee | null>(null);
  const [canShadowSupport, setCanShadowSupport] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setCanShadowSupport(false);
      return;
    }

    supportAPI
      .getMe()
      .then((flags) => setCanShadowSupport(Boolean(flags.canShadow)))
      .catch(() => setCanShadowSupport(false));
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isTelegram || !webApp) return;

    const handleBackButton = () => {
      if (location.pathname === '/home') {
        webApp.close();
      } else {
        navigate(-1);
      }
    };

    if (location.pathname !== '/home') {
      webApp.BackButton.show();
      webApp.BackButton.onClick(handleBackButton);
    } else {
      webApp.BackButton.hide();
    }

    return () => {
      webApp.BackButton.offClick(handleBackButton);
    };
  }, [isTelegram, webApp, location.pathname, navigate]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let isMounted = true;

    const fetchCurrentEmployee = async () => {
      try {
        const employee = await employeesAPI.getCurrentEmployee();
        if (isMounted && employee) {
          setCurrentEmployee(employee);
        }
      } catch (error) {
        console.error('Error fetching current employee in Layout:', error);
        if (isMounted) {
          setCurrentEmployee(null);
        }
      }
    };

    if (isAuthenticated) {
      fetchCurrentEmployee();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const hasMiniAppSource = isTelegram && Boolean(initData);
    const hasWebOAuthSource = !isTelegram && Boolean(localStorage.getItem(TELEGRAM_OAUTH_STORAGE_KEY));

    if (!hasMiniAppSource && !hasWebOAuthSource) {
      return;
    }

    let syncInProgress = false;

    const runSync = async () => {
      if (syncInProgress) {
        return;
      }

      syncInProgress = true;
      try {
        if (hasMiniAppSource && initData) {
          await syncTelegramAuth(initData);
          return;
        }

        if (hasWebOAuthSource) {
          await syncTelegramOAuth();
        }
      } finally {
        syncInProgress = false;
      }
    };

    void runSync();
    const intervalId = window.setInterval(() => {
      void runSync();
    }, TELEGRAM_SYNC_INTERVAL_MS);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isTelegram, isAuthenticated, initData, syncTelegramAuth, syncTelegramOAuth]);

  const displayName = currentEmployee
    ? `${currentEmployee.lastName || ''} ${currentEmployee.firstName || ''}`.trim() || user?.email
    : user?.email;

  const initials = currentEmployee
    ? `${(currentEmployee.firstName || currentEmployee.lastName || '?').charAt(0).toUpperCase()}`
    : `${user?.email.charAt(0).toUpperCase()}`;

  if (!isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  const navigation: NavigationItem[] = [
    { name: 'Главная', href: '/home', icon: Home },
    { name: 'Адресная книга', href: '/employees', icon: Users },
    { name: 'База знаний', href: '/courses', icon: BookOpen },
    { name: 'Наша жизнь', href: '/life', icon: Heart },
    { name: 'Календарь мероприятий', href: '/events', icon: Calendar },
    { name: 'Поддержка', href: '/support', icon: Headphones },
    { name: 'Боты', href: '/bots', icon: Bot },
    { name: 'Структура', href: '/org', icon: Network, adminOnly: true },
    { name: 'Расписание', href: '/bookings', icon: DoorOpen, adminOnly: true },
    {
      name: 'Служебная',
      href: '/support-shadow',
      icon: Shield,
      shadowOnly: true,
    },
    {
      name: 'Общие настройки',
      href: '/settings',
      icon: Settings,
      adminOnly: true,
    },
  ];

  const visibleNavigation = navigation.filter((item) => {
    if (item.shadowOnly) {
      return canShadowSupport;
    }
    if (item.adminOnly) {
      return isAdmin;
    }
    return true;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;
  const pageTitle =
    visibleNavigation.find((item) => isActive(item.href))?.name || SITE_CONFIG.name;
  const isHomeFullscreen = isTelegram && location.pathname === '/home';

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex h-full flex-col" style={{ backgroundColor: 'rgb(229, 229, 229)' }}>
          <div className="flex h-16 items-center justify-center border-b border-white/20 px-4">
            <Logo size="md" />
          </div>

          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {visibleNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center px-4 py-3 rounded-lg transition-all duration-200 whitespace-nowrap
                    ${
                      isActive(item.href)
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

          <div className="border-t border-white/20 p-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white font-medium text-sm">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-pastel-800 truncate">{displayName}</p>
                <p className="text-xs text-pastel-500">
                  {isAdmin ? 'Администратор' : 'Пользователь'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              Выйти
            </button>
          </div>
        </div>
      </div>

      <div className={`flex-1 flex flex-col lg:ml-0 ${isHomeFullscreen ? 'relative h-full' : ''}`}>
        <header className="bg-white/30 backdrop-blur-sm border-b border-white/20 px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
              aria-label="Открыть меню"
            >
              <Menu className="w-6 h-6 text-pastel-700" />
            </button>

            <h1 className="text-xl lg:text-2xl font-bold text-pastel-800 truncate">{pageTitle}</h1>
          </div>
        </header>

        <main
          className={`flex-1 ${
            isHomeFullscreen ? 'p-0 relative h-full overflow-hidden' : 'p-4 lg:p-6'
          }`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
