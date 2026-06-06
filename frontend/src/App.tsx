import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Register } from './pages/Register';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { NewEnvelope } from './pages/NewEnvelope';
import { EnvelopeDetail } from './pages/EnvelopeDetail';
import { SigningCeremony } from './pages/SigningCeremony';
import { VerifyIdentity } from './pages/VerifyIdentity';
import { AdminIDReview } from './pages/AdminIDReview';
import { VerifyCertificate } from './pages/VerifyCertificate';
import { LandingPage } from './pages/LandingPage';
import { ForgotPassword } from './pages/ForgotPassword';
import { Profile } from './pages/Profile';
import { ResetPassword } from './pages/ResetPassword';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Redirect logged-in users from landing/login/register to dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing page */}
      <Route path="/" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Public signing routes — no auth needed */}
      <Route path="/sign/:token" element={<SigningCeremony />} />
      <Route path="/verify/:envelopeId" element={<VerifyCertificate />} />

      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/envelopes" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/envelopes/new" element={<ProtectedRoute><NewEnvelope /></ProtectedRoute>} />
      <Route path="/envelopes/:id" element={<ProtectedRoute><EnvelopeDetail /></ProtectedRoute>} />
      <Route path="/verify-identity" element={<ProtectedRoute><VerifyIdentity /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/admin/id-review" element={<ProtectedRoute adminOnly><AdminIDReview /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#fff', color: '#111', border: '1px solid #e5e7eb', borderRadius: '10px' },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}