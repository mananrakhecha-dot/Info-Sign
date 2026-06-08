import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout';
import { IdentityBadge } from '../components/StatusBadge';

const identityDesc: Record<string, string> = {
  NONE: 'No identity verification completed.',
  SES:  'Standard Electronic Signature — email verified.',
  AES:  'Advanced Electronic Signature — phone + ID verified.',
};

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
      {show ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
        </svg>
      )}
    </button>
  );
}

export function Profile() {
  const { user, refreshUser } = useAuth();
  const [nameForm, setNameForm] = useState({ full_name: user?.full_name || '' });
  const [nameLoading, setNameLoading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', password: '', confirm: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const pw = pwForm.password;
  const pwRules = {
    length:  pw.length >= 8,
    number:  /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
    match:   pw.length > 0 && pw === pwForm.confirm,
  };

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
    } finally { setNameLoading(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwForm.current) return toast.error('Enter your current password');
    if (pwForm.password !== pwForm.confirm) return toast.error('Passwords do not match');
    if (!pwRules.length || !pwRules.number || !pwRules.special) return toast.error('Password does not meet requirements');
    setPwLoading(true);
    try {
      await authApi.changePassword({ current_password: pwForm.current, new_password: pwForm.password });
      toast.success('Password changed successfully');
      setPwForm({ current: '', password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setPwLoading(false); }
  };

  return (
    <Layout>
      <div className="max-w-2xl fade-in-up">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account settings and security</p>
        </div>

        {/* ── Identity card ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5 flex items-center gap-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-sm text-gray-500 truncate mb-2">{user?.email}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <IdentityBadge level={user?.identity_level || 'NONE'} />
              <span className="text-xs text-gray-400">{identityDesc[user?.identity_level || 'NONE']}</span>
            </div>
          </div>
          {user?.identity_level !== 'AES' && (
            <Link to="/verify-identity" className="btn-secondary text-xs flex-shrink-0">
              Upgrade →
            </Link>
          )}
        </div>

        {/* ── Personal info ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h2>
          <form onSubmit={handleNameSave} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" value={nameForm.full_name}
                onChange={e => setNameForm({ full_name: e.target.value })} placeholder="Your full name"/>
            </div>
            <div>
              <label className="label">Email Address</label>
              <input className="input bg-gray-50 text-gray-400 cursor-not-allowed" value={user?.email || ''} disabled/>
              <p className="text-xs text-gray-400 mt-1">Email address cannot be changed</p>
            </div>
            <button type="submit" disabled={nameLoading} className="btn-primary text-sm">
              {nameLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* ── Security ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Security</h2>
          <p className="text-xs text-gray-400 mb-5">Password must be ≥8 chars with a number and special character.</p>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <div className="relative">
                <input className="input pr-10" type={showCurrent ? 'text' : 'password'}
                  value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                  placeholder="Your current password" autoComplete="current-password"/>
                <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(v => !v)}/>
              </div>
            </div>
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <input className="input pr-10" type={showNew ? 'text' : 'password'}
                  value={pwForm.password} onChange={e => setPwForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="New password" autoComplete="new-password"/>
                <EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)}/>
              </div>
              {pw.length > 0 && (
                <div className="flex gap-3 mt-2 flex-wrap">
                  {[
                    { ok: pwRules.length,  label: '8+ chars' },
                    { ok: pwRules.number,  label: 'Number' },
                    { ok: pwRules.special, label: 'Special char' },
                  ].map(r => (
                    <span key={r.label} className={`text-[11px] flex items-center gap-1 font-medium ${r.ok ? 'text-brand-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? 'bg-brand-500' : 'bg-gray-300'}`} />
                      {r.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <div className="relative">
                <input className="input pr-10" type={showConfirm ? 'text' : 'password'}
                  value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                  placeholder="Repeat new password" autoComplete="new-password"/>
                <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)}/>
              </div>
              {pwForm.confirm.length > 0 && (
                <p className={`text-xs mt-1 font-medium ${pwRules.match ? 'text-brand-600' : 'text-red-500'}`}>
                  {pwRules.match ? '✓ Passwords match' : 'Passwords do not match'}
                </p>
              )}
            </div>
            <button type="submit" disabled={pwLoading} className="btn-primary text-sm">
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* ── Account details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Account Details</h2>
          <dl className="space-y-0">
            {[
              { label: 'Role',           value: user?.role },
              { label: 'Identity Level', value: user?.identity_level },
              { label: 'Phone Verified', value: user?.phone_verified ? 'Yes' : 'No' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <dt className="text-sm text-gray-500">{row.label}</dt>
                <dd className="text-sm font-semibold text-gray-900 capitalize">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>

      </div>
    </Layout>
  );
}
