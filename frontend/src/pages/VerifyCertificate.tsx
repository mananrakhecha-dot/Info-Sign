import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyApi } from '../api/envelopes';
import { StatusBadge, IdentityBadge } from '../components/StatusBadge';

export function VerifyCertificate() {
  const { envelopeId } = useParams<{ envelopeId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!envelopeId) return;
    verifyApi.verify(envelopeId)
      .then(res => setData(res.data))
      .catch(() => setError('Envelope not found or verification failed'))
      .finally(() => setLoading(false));
  }, [envelopeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-sm text-gray-500 font-medium">Verifying certificate…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Verification Failed</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-4 fade-in-up">

        {/* ── Verified banner ── */}
        <div className="bg-brand-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold">Certificate Verified</h1>
              <p className="text-brand-200 text-xs">InfoSign Internal CA</p>
            </div>
          </div>
          <p className="text-brand-100 text-sm leading-relaxed">
            This document has been digitally signed using PKI cryptography and verified by the InfoSign Certificate Authority.
          </p>
        </div>

        {/* ── Envelope Details ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Envelope Details</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Envelope ID', value: <span className="font-mono text-xs text-gray-700 break-all">{data.envelopeId}</span> },
              { label: 'Status', value: <StatusBadge status={data.status}/> },
              { label: 'Subject', value: <span className="font-medium text-gray-900 text-sm">{data.subject}</span> },
              { label: 'Completed', value: <span className="text-sm text-gray-700">{data.completedAt ? new Date(data.completedAt).toLocaleString('en-IN') : '—'}</span> },
            ].map(row => (
              <div key={row.label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{row.label}</p>
                {row.value}
              </div>
            ))}
          </div>
        </div>

        {/* ── Document Integrity ── */}
        {data.document && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
              <h2 className="text-sm font-semibold text-gray-900">Document Integrity</h2>
              <span className="ml-auto text-xs text-brand-600 font-semibold bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100">✓ Verified</span>
            </div>
            <p className="text-sm font-medium text-gray-800 mb-2">{data.document.name}</p>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">SHA-256 Hash</p>
              <p className="text-xs font-mono text-gray-600 break-all leading-relaxed">{data.document.sha256Hash}</p>
            </div>
          </div>
        )}

        {/* ── Signers ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Signers</h2>
          <div className="space-y-3">
            {data.signers?.map((signer: any, i: number) => (
              <div key={i} className={`rounded-xl border p-4 ${signer.status === 'SIGNED' ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                    {signer.name?.charAt(0).toUpperCase() || (i + 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{signer.name}</p>
                    <p className="text-xs text-gray-500">{signer.email}</p>
                  </div>
                  <IdentityBadge level={signer.identityLevel}/>
                </div>
                {signer.signedAt && (
                  <p className="text-xs text-gray-400 mt-2 ml-12">
                    Signed {new Date(signer.signedAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Sender ── */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p className="text-sm text-gray-500">
            Sent by <strong className="text-gray-800">{data.sender?.name}</strong>
            <span className="text-gray-400"> · {data.sender?.email}</span>
          </p>
        </div>

      </div>
    </div>
  );
}
