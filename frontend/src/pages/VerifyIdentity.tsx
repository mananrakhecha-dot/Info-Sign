import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api/auth';
import { adminApi } from '../api/envelopes';
import toast from 'react-hot-toast';
import { Layout } from '../components/Layout';
import { IdentityBadge } from '../components/StatusBadge';

type Step = 'overview' | 'phone' | 'otp' | 'id-upload' | 'pending';

const steps = ['Phone', 'Verify OTP', 'Upload ID'];

export function VerifyIdentity() {
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState<Step>('overview');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const stepIndex = step === 'phone' ? 0 : step === 'otp' ? 1 : step === 'id-upload' ? 2 : -1;

  const sendOTP = async () => {
    if (!phone.match(/^\+[1-9]\d{6,14}$/)) {
      toast.error('Enter phone in international format: +91XXXXXXXXXX');
      return;
    }
    setLoading(true);
    try {
      await authApi.sendOTP(phone);
      toast.success('OTP sent! Check your phone.');
      setStep('otp');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    setLoading(true);
    try {
      await authApi.verifyOTP(otp);
      toast.success('Phone verified!');
      await refreshUser();
      setStep('id-upload');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally { setLoading(false); }
  };

  const uploadID = async () => {
    if (!idFile) { toast.error('Please select an ID image'); return; }
    setLoading(true);
    try {
      await adminApi.uploadId(idFile);
      toast.success('ID uploaded! An admin will review your document.');
      setStep('pending');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  const handleFileChange = (file: File | null) => {
    setIdFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setIdPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setIdPreview(null);
    }
  };

  return (
    <Layout>
      <div className="max-w-lg fade-in-up">

        {/* ── Header ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Identity Verification</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upgrade to AES for high-assurance signing</p>
        </div>

        {/* ── Current level ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-5 flex items-center gap-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <IdentityBadge level={user?.identity_level || 'NONE'}/>
        </div>

        {/* ── Step progress (during AES flow) ── */}
        {stepIndex >= 0 && (
          <div className="flex items-center mb-6">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i < stepIndex ? 'bg-brand-600 text-white' :
                    i === stepIndex ? 'bg-brand-600 text-white shadow-lg shadow-brand-200' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {i < stepIndex ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    ) : i + 1}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium ${i === stepIndex ? 'text-brand-600' : 'text-gray-400'}`}>{s}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors ${i < stepIndex ? 'bg-brand-500' : 'bg-gray-200'}`}/>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Overview ── */}
        {step === 'overview' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-xs">SES</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">Simple Electronic Signature</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Email verification — sign standard documents</p>
                  {user?.identity_level === 'SES' || user?.identity_level === 'AES' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-semibold mt-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      Completed
                    </span>
                  ) : <span className="text-xs text-amber-600 mt-1 block">Verify email first</span>}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-brand-700 font-bold text-xs">AES</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">Advanced Electronic Signature</h3>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Phone OTP + Government ID review — highest assurance</p>
                  {user?.identity_level === 'AES' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-semibold mt-2">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      Completed
                    </span>
                  ) : (
                    <button className="btn-primary text-sm mt-3" onClick={() => setStep('phone')}>
                      Start AES Verification
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Phone step ── */}
        {step === 'phone' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 className="font-semibold text-gray-900 mb-1">Phone Verification</h3>
            <p className="text-xs text-gray-500 mb-5">Enter your number in international format (e.g. +919876543210)</p>
            <div className="space-y-4">
              <div>
                <label className="label">Phone Number</label>
                <input className="input" type="tel" placeholder="+91XXXXXXXXXX"
                  value={phone} onChange={e => setPhone(e.target.value)}/>
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setStep('overview')}>Back</button>
                <button className="btn-primary flex-1" onClick={sendOTP} disabled={loading}>
                  {loading ? 'Sending…' : 'Send OTP'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── OTP step ── */}
        {step === 'otp' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 className="font-semibold text-gray-900 mb-1">Enter OTP</h3>
            <p className="text-xs text-gray-500 mb-5">6-digit code sent to <strong className="text-gray-700">{phone}</strong></p>
            <div className="space-y-4">
              <div>
                <label className="label">OTP Code</label>
                <input
                  className="input text-center text-2xl tracking-[0.5em] font-mono"
                  type="text" maxLength={6} placeholder="______"
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setStep('phone')}>Back</button>
                <button className="btn-primary flex-1" onClick={verifyOTP} disabled={loading || otp.length !== 6}>
                  {loading ? 'Verifying…' : 'Verify OTP'}
                </button>
              </div>
              <button className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors" onClick={sendOTP}>
                Resend OTP
              </button>
            </div>
          </div>
        )}

        {/* ── ID Upload step ── */}
        {step === 'id-upload' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h3 className="font-semibold text-gray-900 mb-1">Upload Government ID</h3>
            <p className="text-xs text-gray-500 mb-5">Passport or driver's licence — JPEG/PNG, max 5MB</p>
            <div className="space-y-4">
              <input type="file" accept="image/jpeg,image/png,image/jpg"
                onChange={e => handleFileChange(e.target.files?.[0] || null)}
                className="hidden" id="id-file"/>
              <label htmlFor="id-file" className={`block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                idFile ? 'border-brand-400 bg-brand-50/40' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}>
                {idPreview ? (
                  <div>
                    <img src={idPreview} alt="ID preview" className="h-32 object-contain mx-auto mb-2 rounded-lg"/>
                    <p className="text-xs font-semibold text-brand-600">{idFile?.name}</p>
                    <p className="text-[10px] text-gray-400">{idFile ? (idFile.size / 1024).toFixed(0) + ' KB' : ''}</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                    <p className="text-sm text-gray-500 font-medium">Click to upload ID</p>
                    <p className="text-xs text-gray-400 mt-0.5">JPEG or PNG</p>
                  </div>
                )}
              </label>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => setStep('otp')}>Back</button>
                <button className="btn-primary flex-1" onClick={uploadID} disabled={loading || !idFile}>
                  {loading ? 'Uploading…' : 'Submit for Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Pending ── */}
        {step === 'pending' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Under Review</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Your ID is being reviewed by our team. Once approved, your account will be upgraded to <strong className="text-brand-600">AES</strong> level automatically.
            </p>
          </div>
        )}

      </div>
    </Layout>
  );
}
