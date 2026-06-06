import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout';

const identityInfo: Record<string, { label: string; color: string; desc: string }> = {
  NONE:  { label: 'None',     color: 'bg-gray-100 text-gray-600',    desc: 'No identity verification completed.' },
  SES:   { label: 'SES',      color: 'bg-blue-50 text-blue-700',     desc: 'Standard Electronic Signature — email verified.' },
  AES:   { label: 'AES',      color: 'bg-brand-50 text-brand-700',   desc: 'Advanced Electronic Signature — phone + ID verified.' },
};

export function Profile() {
  const { user, refreshUser } = useAuth();

  const [nameForm, setNameForm] = useState({ full_name: user?.full_name || '' });
  const [nameLoading, setNameLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const levelInfo = identityInfo[user?.identity_level || 'NONE'];

  const handleNameSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameForm.full_name.trim()) return toast.error('Name cannot be empty');
    setNameLoading(true);
    try {
      await authApi.updateProfile({ full_name: nameForm.full_name.trim() });
      await refreshUser();
      toast.success('Name updated');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update name');
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current) return toast.error('Enter your current password');
    if (pwForm.password !== pwForm.confirm) return toast.error('New passwords do not match');
    if (pwForm.password.length < 8) return toast.error('Password must be at least 8 characters');
    if (!/[0-9]/.test(pwForm.password)) return toast.error('Password must contain a number');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwForm.password)) {
      return toast.error('Password must contain a special character');
    }
    setPwLoading(true);
    try {
      await authApi.changePassword({ current_password: pwForm.current, new_password: pwForm.password });
      toast.success('Password changed successfully');
      setPwForm({ current: '', password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  const EyeIcon = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
    <button type="button" onClick={onToggle}
      className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
      {show ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      )}
    </button>
  );

  return (
    <Layout>
      <div className="max-w-2xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1">Manage your account information</p>
        </div>

        {/* Avatar + identity card */}
        <div className="card mb-6 flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-brand-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-sm text-gray-500 truncate">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${levelInfo.color}`}>
                {levelInfo.label}
              </span>
              <span className="text-xs text-gray-400">{levelInfo.desc}</span>
            </div>
          </div>
        </div>

        {/* Update name */}
        <div className="card mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Personal information</h2>
          <form onSubmit={handleNameSave} className="space-y-4">
            <div>
              <label className="label">Full name</label>
              <input
                className="input"
                value={nameForm.full_name}
                onChange={e => setNameForm({ full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="label">Email address</label>
              <input
                className="input bg-gray-50 cursor-not-allowed"
                value={user?.email || ''}
                disabled
              />
              <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={nameLoading}
                className="btn-primary text-sm"
              >
                {nameLoading ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="card mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-1">Change password</h2>
          <p className="text-sm text-gray-500 mb-4">
            Must be at least 8 characters with a number and special character.
          </p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="label">Current password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showCurrent ? 'text' : 'password'}
                  value={pwForm.current}
                  onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
                <EyeIcon show={showCurrent} onToggle={() => setShowCurrent(v => !v)} />
              </div>
            </div>
            <div>
              <label className="label">New password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showNew ? 'text' : 'password'}
                  value={pwForm.password}
                  onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <EyeIcon show={showNew} onToggle={() => setShowNew(v => !v)} />
              </div>
            </div>
            <div>
              <label className="label">Confirm new password</label>
              <div className="relative">
                <input
                  className="input pr-10"
                  type={showConfirm ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                />
                <EyeIcon show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
              </div>
            </div>
            <button
              type="submit"
              disabled={pwLoading}
              className="btn-primary text-sm"
            >
              {pwLoading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>

        {/* Account info */}
        <div className="card">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Account details</h2>
          <dl className="space-y-3">
            {[
              { label: 'Role',             value: user?.role },
              { label: 'Identity level',   value: user?.identity_level },
              { label: 'Phone verified',   value: user?.phone_verified ? 'Yes' : 'No' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <dt className="text-sm text-gray-500">{row.label}</dt>
                <dd className="text-sm font-medium text-gray-900">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </Layout>
  );
}