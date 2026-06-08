import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';
import { motion, easeOut } from 'framer-motion';
import { Eye, EyeOff, FileText, UserPlus } from 'lucide-react';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeOut } } };

export function Register() {
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [edisclosure, setEdisclosure] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const pw = form.password;
  const rules = {
    length:  pw.length >= 8,
    number:  /[0-9]/.test(pw),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edisclosure) { toast.error('You must accept the eDisclosure to register'); return; }
    setLoading(true);
    try {
      await authApi.register(form.email, form.password, form.full_name, edisclosure);
      setDone(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-blue-50 p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.45 }}
          className="bg-white rounded-2xl border border-gray-100 shadow-xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check your email</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            We sent a verification link to <strong className="text-gray-700">{form.email}</strong>. Click it to activate your account.
          </p>
          <Link to="/login" className="btn-primary w-full justify-center">Back to Sign In</Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex bg-white overflow-hidden">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex w-[48%] relative flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 via-white to-emerald-50 border-r border-gray-100">
        <div className="relative z-10 flex flex-col items-center text-center px-14 max-w-lg">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6 }}
            className="w-16 h-16 rounded-2xl bg-brand-600 flex items-center justify-center shadow-xl shadow-brand-200 mb-8">
            <FileText className="w-8 h-8 text-white"/>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="text-4xl font-bold text-gray-900 mb-4 leading-tight tracking-tight">
            Start signing <span className="text-brand-600">securely.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.6 }}
            className="text-gray-500 text-base leading-relaxed mb-10">
            Join InfoSign and get legally-binding digital signatures with PKI cryptography, full audit trails, and enterprise-grade security.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="flex flex-col gap-3 w-full">
            {['Free to start', 'No credit card required', 'AES-256 encrypted'].map(f => (
              <div key={f} className="flex items-center gap-3 bg-white/70 border border-brand-100 rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                <span className="text-sm text-gray-600 font-medium">{f}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-white">
        <motion.div variants={container} initial="hidden" animate="show" className="w-full max-w-md">

          {/* Mobile logo */}
          <motion.div variants={item} className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white"/>
            </div>
            <span className="text-lg font-bold text-gray-900">InfoSign</span>
          </motion.div>

          <motion.div variants={item} className="mb-7">
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Create your account</h2>
            <p className="text-sm text-gray-500 mt-1">Start signing documents in minutes</p>
          </motion.div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <motion.div variants={item}>
                <label className="label">Full Name</label>
                <input className="input" type="text" placeholder="John Doe"
                  value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required/>
              </motion.div>

              <motion.div variants={item}>
                <label className="label">Email Address</label>
                <input className="input" type="email" placeholder="you@example.com"
                  value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required/>
              </motion.div>

              <motion.div variants={item}>
                <label className="label">Password</label>
                <div className="relative">
                  <input className="input pr-10" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters"
                    value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8}/>
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
                {pw.length > 0 && (
                  <div className="flex gap-3 mt-2 flex-wrap">
                    {[
                      { ok: rules.length,  label: '8+ chars' },
                      { ok: rules.number,  label: 'Number' },
                      { ok: rules.special, label: 'Special char' },
                    ].map(r => (
                      <span key={r.label} className={`text-[11px] flex items-center gap-1 font-medium transition-colors ${r.ok ? 'text-brand-600' : 'text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full transition-colors ${r.ok ? 'bg-brand-500' : 'bg-gray-300'}`}/>
                        {r.label}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>

              <motion.div variants={item}>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-xs text-gray-500 max-h-28 overflow-y-auto leading-relaxed">
                  <p className="font-semibold text-gray-700 mb-1.5">eDisclosure — Electronic Records & Signatures</p>
                  <p>By creating an account, you consent to use electronic signatures and records. Your electronic signature is the legal equivalent of your manual signature. Documents signed electronically are legally binding. You have the right to request paper copies and can withdraw consent at any time.</p>
                </div>
                <label className="flex items-start gap-3 mt-3 cursor-pointer group">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    checked={edisclosure} onChange={e => setEdisclosure(e.target.checked)}/>
                  <span className="text-sm text-gray-600 group-hover:text-gray-800 transition-colors leading-relaxed">
                    I have read and agree to the Electronic Records and Signature Disclosure. <span className="text-red-500">*</span>
                  </span>
                </label>
              </motion.div>

              <motion.div variants={item}>
                <button type="submit" disabled={loading || !edisclosure} className="btn-primary w-full justify-center">
                  {loading ? (
                    <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating account…</span>
                  ) : (
                    <span className="flex items-center gap-2"><UserPlus className="w-4 h-4"/>Create Account</span>
                  )}
                </button>
              </motion.div>
            </div>
          </form>

          <motion.div variants={item} className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200"/>
            <span className="text-xs text-gray-400 font-medium">Already have an account?</span>
            <div className="flex-1 h-px bg-gray-200"/>
          </motion.div>

          <motion.div variants={item}>
            <Link to="/login">
              <div className="w-full py-3 rounded-xl border-2 border-gray-200 hover:border-brand-300 bg-white hover:bg-brand-50 text-center text-sm font-semibold text-gray-600 hover:text-brand-700 transition-all duration-200 cursor-pointer">
                Sign in instead
              </div>
            </Link>
          </motion.div>

        </motion.div>
      </div>
    </div>
  );
}
