import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './stores/authStore';

// Layouts
import DashboardLayout from './components/layouts/DashboardLayout';
import AuthLayout from './components/layouts/AuthLayout';

// Auth Pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Dashboard Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import PatientsPage from './pages/patients/PatientsPage';
import PatientDetailPage from './pages/patients/PatientDetailPage';
import CarePlansPage from './pages/carePlans/CarePlansPage';
import CarePlanDetailPage from './pages/carePlans/CarePlanDetailPage';
import CampaignsPage from './pages/campaigns/CampaignsPage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import AnalyticsPage from './pages/analytics/AnalyticsPage';
import AIPlaygroundPage from './pages/ai/AIPlaygroundPage';
import SettingsPage from './pages/settings/SettingsPage';
import UsersPage from './pages/admin/UsersPage';

// EPIC Callback
import EpicCallbackPage from './pages/epic/EpicCallbackPage';

// Protected Route wrapper
const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const { fetchProfile, isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/register" element={
          isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />
        } />
      </Route>

      {/* EPIC OAuth Callback */}
      <Route path="/callback" element={<EpicCallbackPage />} />

      {/* Protected Dashboard Routes */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/patients/:id" element={<PatientDetailPage />} />
        <Route path="/care-plans" element={<CarePlansPage />} />
        <Route path="/care-plans/:id" element={<CarePlanDetailPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/ai-playground" element={<AIPlaygroundPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/users" element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        } />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
