import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { signingApi } from '../api/envelopes';
import { SignatureCaptureModal } from '../components/SignatureCaptureModal';
import toast from 'react-hot-toast';

type SigningStep = 'loading' | 'edisclosure' | 'view' | 'done' | 'error' | 'already-signed';

export function SigningCeremony() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<SigningStep>('loading');
  const [context, setContext] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [signatureData, setSignatureData] = useState<Record<string, string>>({});
  const [captureFieldId, setCaptureFieldId] = useState<string | null>(null);
  const [declineMode, setDeclineMode] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    signingApi.getContext(token)
      .then(res => {
        setContext(res.data);
        const dateFields: any[] = (res.data.fields || []).filter((f: any) => f.field_type === 'date');
        if (dateFields.length > 0) {
          const d = new Date();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const today = `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
          setSignatureData(prev => {
            const updates: Record<string, string> = {};
            dateFields.forEach((f: any) => { if (!prev[f.id]) updates[f.id] = today; });
            return { ...prev, ...updates };
          });
        }
        if (res.data.recipient?.status === 'SIGNED') {
          setStep('already-signed');
        } else if (!res.data.userRecord?.edisclosure_accepted) {
          setStep('edisclosure');
        } else {
          setStep('view');
        }
      })
      .catch(err => {
        setStep('error');
        const status = err.response?.status;
        const msg = err.response?.data?.error;
        if (status === 410 || status === 401) {
          setErrorMsg('This signing link is invalid or has expired. Please ask the sender for a new link.');
        } else if (status === 409) {
          setStep('already-signed');
        } else {
          setErrorMsg(msg || 'Failed to load signing session. Please try again.');
        }
      });
  }, [token]);

  const needsCapture = (field: any) => field.field_type === 'signature' || field.field_type === 'initials';

  const handleCaptureConfirm = useCallback((base64: string) => {
    if (!captureFieldId) return;
    setSignatureData(prev => ({ ...prev, [captureFieldId]: base64 }));
    toast.success('Signature captured');
    setCaptureFieldId(null);
  }, [captureFieldId]);

  const handleComplete = async () => {
    if (!token) return;
    const fields: any[] = context?.fields || [];
    const sigFields = fields.filter(needsCapture);
    const missing = sigFields.filter((f: any) => !signatureData[f.id]);
    if (missing.length > 0) { toast.error(`Please sign all ${missing.length} required field(s)`); return; }
    setSubmitting(true);
    try {
      await signingApi.complete(token, signatureData, otpRequired ? otpCode : undefined);
      setStep('done');
    } catch (err: any) {
      const status = err.response?.status;
      const msg = err.response?.data?.error || 'Signing failed';
      if (status === 410 || status === 401) {
        setStep('error');
        setErrorMsg('This signing link is invalid or has expired.');
      } else if (msg.includes('OTP') || msg.includes('AES')) {
        setOtpRequired(true);
        toast.error('Please enter your OTP code to complete signing');
      } else {
        toast.error(msg);
      }
    } finally { setSubmitting(false); }
  };

  const handleDecline = async () => {
    if (!token || !declineReason) return;
    try {
      await signingApi.decline(token, declineReason);
      setStep('done');
      toast('You have declined to sign this document.');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to decline'); }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">Loading signing session…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Cannot Sign</h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">{errorMsg}</p>
          <a href="/verify-identity" className="btn-primary">Complete Identity Verification</a>
        </div>
      </div>
    );
  }

  // ── Already Signed ───────────────────────────────────────────────────────
  if (step === 'already-signed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Already Signed</h2>
          <p className="text-sm text-gray-500">You have already signed this document. Thank you!</p>
        </div>
      </div>
    );
  }

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <div className="absolute inset-0 rounded-full bg-brand-100 animate-ping opacity-30" />
            <svg className="w-10 h-10 text-brand-600 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">Signing Complete!</h2>
          <p className="text-sm text-gray-500 mb-1 leading-relaxed">Your digital signature has been applied to the document using PKI cryptography.</p>
          <p className="text-xs text-gray-400 mb-8">Verified by InfoSign Internal CA</p>
          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <span className="text-xs font-semibold text-brand-700">Cryptographic Signature Applied</span>
            </div>
            <p className="text-xs text-brand-600">Algorithm: SHA-256 + RSA-2048 · Standard: PKCS#7 / ISO 32000</p>
          </div>
          <a href="/dashboard" className="btn-primary w-full justify-center">View Dashboard</a>
        </div>
      </div>
    );
  }

  // ── eDisclosure ──────────────────────────────────────────────────────────
  if (step === 'edisclosure') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Electronic Signature Consent</h2>
              <p className="text-xs text-gray-500">Review and accept before signing</p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 max-h-48 overflow-y-auto mb-5 border border-gray-100 leading-relaxed">
            <p className="font-semibold text-gray-800 mb-2">Electronic Records & Signatures Disclosure</p>
            <p>You are about to electronically sign a legally binding document. By clicking "Accept & Continue", you consent to the use of electronic signatures and records. Your electronic signature has the same legal effect as a handwritten signature. You confirm that you have read the document and agree to sign electronically.</p>
          </div>
          <div className="flex gap-3">
            <button className="btn-secondary flex-shrink-0" onClick={() => { setDeclineMode(true); setStep('view'); }}>Decline</button>
            <button className="btn-primary flex-1" onClick={async () => {
              try {
                const api = await import('../api/client');
                await api.default.post('/auth/edisclosure');
                setStep('view');
                toast.success('eDisclosure accepted');
              } catch { toast.error('Failed to accept eDisclosure'); }
            }}>Accept & Continue</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main signing view ────────────────────────────────────────────────────
  const fields: any[] = context?.fields || [];
  const docUrl = signingApi.getDocumentUrl(token!);
  const captureFields = fields.filter(needsCapture);
  const signedCount = captureFields.filter((f: any) => signatureData[f.id]).length;
  const allSigned = signedCount === captureFields.length && captureFields.length >= 0;
  const captureField = captureFieldId ? fields.find((f: any) => f.id === captureFieldId) : null;
  const remaining = captureFields.length - signedCount;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-brand-600 rounded flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              </div>
              <h1 className="font-semibold text-gray-900 text-sm truncate">{context?.envelope?.subject}</h1>
            </div>
            <p className="text-xs text-gray-400 mt-0.5 ml-8">{context?.recipient?.user_email}</p>
          </div>

          {/* Progress indicator */}
          {captureFields.length > 0 && (
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {captureFields.map((_: any, i: number) => (
                  <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < signedCount ? 'bg-brand-500' : 'bg-gray-200'}`} />
                ))}
              </div>
              <span className="text-xs font-medium text-gray-500">{signedCount}/{captureFields.length} signed</span>
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="btn-secondary text-sm py-2" onClick={() => setDeclineMode(!declineMode)}>Decline</button>
            {otpRequired && (
              <input
                className="input text-sm py-2 w-28"
                placeholder="OTP Code"
                value={otpCode}
                onChange={e => setOtpCode(e.target.value)}
                maxLength={6}
              />
            )}
            <button
              className="btn-primary text-sm py-2"
              onClick={handleComplete}
              disabled={!allSigned || submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>
                  Submitting…
                </span>
              ) : allSigned ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Finish Signing
                </span>
              ) : `Sign ${remaining} more`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Decline form ── */}
      {declineMode && (
        <div className="max-w-6xl mx-auto px-4 pt-4 w-full">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h3 className="font-semibold text-red-800 mb-1">Decline to Sign</h3>
            <p className="text-sm text-red-600 mb-3">Please provide a reason for declining.</p>
            <input className="input mb-3" type="text" placeholder="Reason for declining..."
              value={declineReason} onChange={e => setDeclineReason(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setDeclineMode(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleDecline} disabled={!declineReason}>Confirm Decline</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 max-w-6xl mx-auto px-4 py-5 w-full grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* PDF viewer */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
              Document
            </h2>
            <span className="text-[10px] font-mono text-gray-400 truncate max-w-[200px]">
              SHA-256: {context?.documents?.[0]?.sha256_hash?.slice(0, 16) || '…'}
            </span>
          </div>
          <div className="bg-gray-100" style={{ minHeight: '600px' }}>
            <iframe src={docUrl} className="w-full" style={{ height: '680px', border: 'none' }} title="Document for signing" />
          </div>
        </div>

        {/* Signature fields panel */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Your Fields</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fields.length} field{fields.length !== 1 ? 's' : ''} to complete</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {fields.map((field: any) => {
              const isCaptureType = needsCapture(field);
              const confirmed = signatureData[field.id];
              const hasPrefill = field.preview_data && !confirmed;

              return (
                <div
                  key={field.id}
                  className={`rounded-xl border-2 p-3 transition-all duration-200 ${
                    confirmed ? 'border-brand-300 bg-brand-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {confirmed ? (
                        <div className="w-5 h-5 bg-brand-500 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-gray-100 rounded-full border-2 border-gray-300" />
                      )}
                      <span className="text-xs font-semibold text-gray-700 capitalize">{field.field_type}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">Page {field.page_number}</span>
                  </div>

                  {isCaptureType && confirmed && (
                    <div>
                      <img src={confirmed} alt={field.field_type} className="h-10 w-full object-contain mb-2 rounded" />
                      <div className="flex gap-2">
                        <button className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                          onClick={() => setSignatureData(p => { const n = { ...p }; delete n[field.id]; return n; })}>Clear</button>
                        <button className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                          onClick={() => setCaptureFieldId(field.id)}>Change</button>
                      </div>
                    </div>
                  )}

                  {isCaptureType && hasPrefill && (
                    <div>
                      <img src={field.preview_data} alt="pre-filled" className="h-10 w-full object-contain mb-2 opacity-60 rounded" />
                      <div className="flex gap-2">
                        <button className="btn-primary text-xs py-1 px-2 flex-1"
                          onClick={() => setSignatureData(p => ({ ...p, [field.id]: field.preview_data }))}>
                          Use this
                        </button>
                        <button className="btn-secondary text-xs py-1 px-2"
                          onClick={() => setCaptureFieldId(field.id)}>Change</button>
                      </div>
                    </div>
                  )}

                  {isCaptureType && !confirmed && !hasPrefill && (
                    <button
                      className="w-full text-center py-2 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors"
                      onClick={() => setCaptureFieldId(field.id)}
                    >
                      Click to sign
                    </button>
                  )}

                  {field.field_type === 'date' && (
                    <p className="text-sm text-gray-700 font-medium">{signatureData[field.id] || new Date().toLocaleDateString('en-IN')}</p>
                  )}
                </div>
              );
            })}
            {fields.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No fields assigned to you</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Signature Capture Modal ── */}
      {captureFieldId && captureField && (
        <SignatureCaptureModal
          fieldType={captureField.field_type === 'initials' ? 'initials' : 'signature'}
          onConfirm={handleCaptureConfirm}
          onCancel={() => setCaptureFieldId(null)}
        />
      )}
    </div>
  );
}
