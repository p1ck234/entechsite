import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import TelegramAuth from './pages/TelegramAuth';
import Employees from './pages/Employees';
import Courses from './pages/Courses';
import Life from './pages/Life';
import Calendar from './pages/Calendar';
import Bookings from './pages/Bookings';
import Bots from './pages/Bots';
import OrgStructure from './pages/OrgStructure';
import Support from './pages/Support';
import SupportShadow from './pages/SupportShadow';
import AdminSettings from './pages/AdminSettings';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!isAdmin) {
    return <Navigate to="/home" replace />;
  }

  return <>{children}</>;
};

const DefaultAppRedirect: React.FC = () => <Navigate to="/home" replace />;

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={!isAuthenticated ? <Login /> : <DefaultAppRedirect />} />
      <Route path="/auth" element={!isAuthenticated ? <TelegramAuth /> : <DefaultAppRedirect />} />
      
      {/* Protected routes with Layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/home" element={<Home />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/org" element={<AdminRoute><OrgStructure /></AdminRoute>} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/life" element={<Life />} />
        <Route path="/events" element={<Calendar />} />
        <Route path="/bookings" element={<AdminRoute><Bookings /></AdminRoute>} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support-shadow" element={<SupportShadow />} />
        <Route path="/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="/dashboard" element={<DefaultAppRedirect />} />
        <Route path="/profile" element={<DefaultAppRedirect />} />
      </Route>
      
      {/* Catch all route - redirect to home if not authenticated, home (with layout) if authenticated */}
      <Route path="*" element={!isAuthenticated ? <Navigate to="/" replace /> : <DefaultAppRedirect />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen gradient-bg">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
