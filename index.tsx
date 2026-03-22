import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import LoginPage from './auth/LoginPage';
import AdminLayout from './admin/AdminLayout';
import AdminDashboard from './admin/AdminDashboard';
import MonetizationPage from './admin/MonetizationPage';
import PayoutPage from './admin/PayoutPage';
import UsersPage from './admin/UsersPage';
import BadgesPage from './admin/BadgesPage';
import TokensPage from './admin/TokensPage';
import GiftsPage from './admin/GiftsPage';
import AdminsPage from './admin/AdminsPage';
import AdsCentrePage from './admin/AdsCentrePage';
import NotificationCentrePage from './admin/NotificationCentrePage';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="admin/login" element={<LoginPage />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute requiredPermission="view_dashboard">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route
              path="ads"
              element={
                <ProtectedRoute requiredPermission="manage_explore_ads">
                  <AdsCentrePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="notifications"
              element={
                <ProtectedRoute requiredPermission="send_app_notifications">
                  <NotificationCentrePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="monetization"
              element={
                <ProtectedRoute requiredPermission="manage_monetization">
                  <MonetizationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="payout"
              element={
                <ProtectedRoute requiredPermission="manage_monetization">
                  <PayoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute requiredPermission="manage_users">
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="badges"
              element={
                <ProtectedRoute requiredPermission="manage_badges">
                  <BadgesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="tokens"
              element={
                <ProtectedRoute requiredPermission="manage_tokens">
                  <TokensPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="gifts"
              element={
                <ProtectedRoute requiredPermission="manage_gifts">
                  <GiftsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admins"
              element={
                <ProtectedRoute requiredPermission="manage_admins">
                  <AdminsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="admin/*" element={<Navigate to="/admin/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
