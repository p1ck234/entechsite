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
import Bots from './pages/Bots';
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

const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/home" replace />} />
      <Route path="/auth" element={!isAuthenticated ? <TelegramAuth /> : <Navigate to="/home" replace />} />
      
      {/* Protected routes with Layout */}
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/home" element={<Home />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/life" element={<Life />} />
        <Route path="/events" element={<Calendar />} />
        <Route path="/bots" element={<Bots />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/profile" element={<Navigate to="/home" replace />} />
      </Route>
      
      {/* Catch all route - redirect to home if not authenticated, home (with layout) if authenticated */}
      <Route path="*" element={!isAuthenticated ? <Navigate to="/" replace /> : <Navigate to="/home" replace />} />
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
