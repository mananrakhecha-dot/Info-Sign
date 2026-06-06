import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowLeft, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { authApi } from '../api/auth';

type Status = 'validating' | 'valid' | 'invalid' | 'submitting' | 'success';

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-brand-600' : 'text-gray-400'}`}>
      <CheckCircle className={`w-3.5 h-3.5 ${met ? 'text-brand-500' : 'text-gray-300'}`} />
      {text}
    </div>
  );
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<Status>('validating');
  const [form, setForm] = useState({ password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(3);

  // Validate token on mount
  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    authApi.validateResetToken(token)
      .then(() => setStatus('valid'))
      .catch(() => setStatus('invalid'));
  }, [token]);

  // Countdown redirect after success
  useEffect(() => {
    if (status !== 'success') return;
    const id = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(id); navigate('/login'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, navigate]);

  // Password rules
  const pw = form.password;
  const rules = {
    length: pw.length >= 8,
    number: /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!rules.length || !rules.number || !rules.special) {
      setError('Password does not meet the requirements below.'); return;
    }
    if (form.password !== form.confirm) {
      setError('Passwords do not match.'); return;
    }
    setStatus('submitting');
    try {
      await authApi.resetPassword(token, form.password);
      setStatus('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.');
      setStatus('valid');
    }
  };

  // ── Validating ─────────────────────────────────────────────────────────────
  if (status === 'validating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Validating your reset link...</p>
        </div>
      </div>
    );
  }

  // ── Invalid / Expired ──────────────────────────────────────────────────────
  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">Link expired or invalid</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            This password reset link has expired or has already been used.
            Reset links are valid for 30 minutes and can only be used once.
          </p>
          <Link to="/forgot-password">
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="btn-primary w-full py-2.5 mb-4"
            >
              Request a new link
            </motion.button>
          </Link>
          <Link to="/login"
            className="flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle className="w-8 h-8 text-brand-600" />
          </motion.div>
          <h1 className="text-xl font-bold text-gray-900 mb-3">Password reset successfully</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-2">
            Your password has been updated. All active sessions have been signed out for security.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            Redirecting to sign in in {countdown} second{countdown !== 1 ? 's' : ''}...
          </p>
          <Link to="/login">
            <motion.button
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
              className="btn-primary w-full py-2.5"
            >
              Sign in now
            </motion.button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Reset Form (valid + submitting) ────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">DocuSign</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl shadow-gray-100/60 border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Set new password</h1>
            <p className="text-gray-500 text-sm">
              Choose a strong password for your account.
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* New password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  autoFocus
                  autoComplete="new-password"
                />
                <button type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Password rules */}
              {form.password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 space-y-1"
                >
                  <PasswordRule met={rules.length} text="At least 8 characters" />
                  <PasswordRule met={rules.number} text="Contains a number" />
                  <PasswordRule met={rules.special} text="Contains a special character" />
                </motion.div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm new password
              </label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={form.confirm}
                  onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                  required
                  autoComplete="new-password"
                />
                <button type="button"
                  className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                  onClick={() => setShowConfirm(!showConfirm)}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Match indicator */}
              {form.confirm.length > 0 && (
                <p className={`text-xs mt-1.5 ${form.password === form.confirm ? 'text-brand-600' : 'text-red-500'}`}>
                  {form.password === form.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={status === 'submitting'}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {status === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </motion.button>
          </form>

          <div className="flex items-center justify-center mt-6 pt-5 border-t border-gray-100">
            <Link to="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}