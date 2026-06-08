import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { Timeline } from '../components/Timeline';
import { TrustIndicator } from '../components/TrustIndicator';
import { envelopeApi, EnvelopeDetail as EnvDetail } from '../api/envelopes';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import api from '../api/client';

export function EnvelopeDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { joinEnvelope, on } = useSocket();
  const [envelope, setEnvelope] = useState<EnvDetail | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [voidReason, setVoidReason] = useState('');
  const [showVoid, setShowVoid] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingCert, setDownloadingCert] = useState(false);
  const [reminderSending, setReminderSending] = useState<string | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [envRes, histRes] = await Promise.all([
        envelopeApi.get(id),
        envelopeApi.history(id),
      ]);
      setEnvelope(envRes.data);
      setEvents(histRes.data);
    } catch { toast.error('Failed to load envelope'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [id]);

  useEffect(() => {
    if (!id) return;
    joinEnvelope(id);
    const off1 = on('envelope:recipient_signed', () => { fetchData(); toast('A recipient has signed!'); });
    const off2 = on('envelope:completed', () => { fetchData(); toast.success('All parties have signed! Envelope completed.'); });
    return () => { off1(); off2(); };
  }, [id]);

  const downloadFile = async (type: 'pdf' | 'certificate') => {
    if (!id) return;
    const isCert = type === 'certificate';
    if (isCert) setDownloadingCert(true); else setDownloading(true);
    try {
      const url = isCert ? `/envelopes/${id}/certificate` : `/envelopes/${id}/download`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = isCert ? `certificate-${id}.pdf` : `${envelope?.subject || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
      toast.success(isCert ? 'Certificate downloaded' : 'PDF downloaded');
    } catch (err: any) {
      const msg = err.response?.status === 404
        ? (isCert ? 'Certificate not available yet' : 'Document not found')
        : 'Download failed';
      toast.error(msg);
    } finally {
      if (isCert) setDownloadingCert(false); else setDownloading(false);
    }
  };

  const handleVoid = async () => {
    if (!id || !voidReason) return;
    try {
      await envelopeApi.void(id, voidReason);
      toast.success('Envelope voided');
      fetchData();
      setShowVoid(false);
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to void'); }
  };

  const handleRemind = async (recipientId: string) => {
    if (!id) return;
    setReminderSending(recipientId);
    try {
      await envelopeApi.remind(id, recipientId);
      toast.success('Reminder sent');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send reminder');
    } finally {
      setReminderSending(null);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6 fade-in-up">
          <div className="flex items-center gap-3">
            <div className="skeleton h-4 w-24 rounded" />
          </div>
          <div className="skeleton h-8 w-64 rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {[1,2].map(i => <div key={i} className="skeleton h-40 rounded-2xl" />)}
            </div>
            <div className="skeleton h-96 rounded-2xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!envelope) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">Envelope not found</p>
          <Link to="/dashboard" className="btn-secondary mt-4 inline-flex">← Back to Dashboard</Link>
        </div>
      </Layout>
    );
  }

  const intCA = 'DocuSign Internal CA';
  const isCompleted = envelope.status === 'COMPLETED';
  const canVoid = ['DRAFT', 'SENT', 'DELIVERED'].includes(envelope.status);
  const isSenderOrAdmin = user?.id === envelope.sender_id || user?.role === 'admin';
  const signedCount = envelope.recipients.filter(r => r.status === 'SIGNED').length;

  return (
    <Layout>
      <div className="space-y-6 fade-in-up">

        {/* ── Back + Header ── */}
        <div>
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-3">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Dashboard
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{envelope.subject}</h1>
              <div className="flex items-center gap-2.5 mt-2 flex-wrap">
                <StatusBadge status={envelope.status} />
                <span className="text-xs text-gray-400 font-mono">ID: {envelope.id.slice(0, 8)}…</span>
                <span className="text-xs text-gray-400">
                  Created {new Date(envelope.created_at).toLocaleDateString('en-IN')}
                </span>
                {envelope.completed_at && (
                  <span className="text-xs text-brand-600 font-medium">
                    Completed {new Date(envelope.completed_at).toLocaleDateString('en-IN')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 flex-shrink-0">
              {isCompleted && (
                <>
                  <button onClick={() => downloadFile('pdf')} disabled={downloading} className="btn-secondary text-sm">
                    {downloading ? (
                      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>Downloading…</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                        Download PDF
                      </span>
                    )}
                  </button>
                  <button onClick={() => downloadFile('certificate')} disabled={downloadingCert} className="btn-primary text-sm">
                    {downloadingCert ? (
                      <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Downloading…</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"/></svg>
                        Certificate
                      </span>
                    )}
                  </button>
                </>
              )}
              {canVoid && (
                <button className="btn-danger text-sm" onClick={() => setShowVoid(!showVoid)}>
                  Void
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Void form ── */}
        {showVoid && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <h3 className="font-semibold text-red-800 mb-1">Void Envelope</h3>
            <p className="text-sm text-red-600 mb-3">Provide a reason for voiding this envelope.</p>
            <input className="input mb-3" type="text" placeholder="Reason for voiding..."
              value={voidReason} onChange={e => setVoidReason(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setShowVoid(false)}>Cancel</button>
              <button className="btn-danger" onClick={handleVoid} disabled={!voidReason}>Confirm Void</button>
            </div>
          </div>
        )}

        {/* ── Progress bar (if sent) ── */}
        {envelope.recipients.length > 0 && !['DRAFT', 'VOIDED', 'DECLINED'].includes(envelope.status) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Signing Progress</span>
              <span className="text-sm text-gray-500">{signedCount} of {envelope.recipients.length} signed</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all duration-700"
                style={{ width: `${(signedCount / envelope.recipients.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Recipients + Documents */}
          <div className="lg:col-span-2 space-y-5">

            {/* Recipients */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                Recipients
                <span className="ml-auto text-xs font-normal text-gray-400">{envelope.recipients.length} total</span>
              </h2>
              <div className="space-y-3">
                {envelope.recipients.map((r, idx) => (
                  <div key={r.id} className="rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                        {r.full_name?.charAt(0).toUpperCase() || (idx + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{r.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{r.user_email}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Auth Required</p>
                        <p className="text-xs font-medium text-gray-700">{r.auth_required}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Viewed</p>
                        <p className="text-xs text-gray-700">{r.viewed_at ? new Date(r.viewed_at).toLocaleDateString('en-IN') : <span className="text-gray-300">—</span>}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Signed</p>
                        <p className="text-xs text-gray-700">{r.signed_at ? new Date(r.signed_at).toLocaleDateString('en-IN') : <span className="text-gray-300">—</span>}</p>
                      </div>
                    </div>

                    {r.last_reminded_at && (
                      <div className="mt-2 pt-2 border-t border-gray-50">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Last Reminder</p>
                        <p className="text-xs text-gray-700">{new Date(r.last_reminded_at).toLocaleDateString('en-IN')} ({r.reminder_count} sent)</p>
                      </div>
                    )}

                    {r.status === 'PENDING' && isSenderOrAdmin && (
                      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          Awaiting signature
                        </p>
                        <button
                          onClick={() => handleRemind(r.id)}
                          disabled={reminderSending === r.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-xs font-semibold text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reminderSending === r.id ? (
                            <>
                              <span className="w-3 h-3 border-2 border-brand-400 border-t-brand-600 rounded-full animate-spin"/>
                              Sending…
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                              Send Reminder
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {r.status === 'SIGNED' && (
                      <div className="mt-3">
                        <TrustIndicator
                          signerName={r.full_name}
                          signerEmail={r.user_email}
                          caName={intCA}
                          signedAt={r.signed_at!}
                          identityLevel={r.auth_required}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Document */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                Documents
              </h2>
              <div className="space-y-2">
                {envelope.documents.map(doc => (
                  <div key={doc.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{doc.file_name}</p>
                      <p className="text-[10px] font-mono text-gray-400 mt-0.5 truncate">SHA-256: {doc.sha256_hash}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{doc.page_count} page{doc.page_count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                      <span className="text-[10px] text-brand-600 font-medium">Verified</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Audit Trail */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
              Audit Trail
              <span className="ml-auto text-xs font-normal text-gray-400">{events.length} events</span>
            </h2>
            <Timeline events={events} />
          </div>
        </div>

      </div>
    </Layout>
  );
}
