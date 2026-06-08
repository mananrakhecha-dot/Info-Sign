import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { adminApi } from '../api/envelopes';
import toast from 'react-hot-toast';

export function AdminIDReview() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchReviews = async () => {
    try {
      const res = await adminApi.listReviews();
      setReviews(res.data);
    } catch { toast.error('Failed to load reviews'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleApprove = async (uploadId: string) => {
    try {
      await adminApi.approve(uploadId);
      toast.success('ID approved. User promoted to AES if phone is also verified.');
      fetchReviews();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Approval failed'); }
  };

  const handleReject = async (uploadId: string) => {
    if (!rejectReason) { toast.error('Please enter a rejection reason'); return; }
    try {
      await adminApi.reject(uploadId, rejectReason);
      toast.success('ID rejected');
      setSelected(null);
      setRejectReason('');
      fetchReviews();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Rejection failed'); }
  };

  return (
    <Layout>
      <div className="space-y-6 fade-in-up">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">ID Review Queue</h1>
            <p className="text-sm text-gray-500 mt-0.5">Review government ID uploads for AES verification</p>
          </div>
          {reviews.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {reviews.length} pending
            </span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[1,2].map(i => <div key={i} className="skeleton h-80 rounded-2xl"/>)}
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">All caught up!</p>
            <p className="text-sm text-gray-400">No pending ID reviews at this time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reviews.map(review => (
              <div key={review.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

                {/* User info */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                        {review.full_name?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{review.full_name}</p>
                        <p className="text-xs text-gray-500">{review.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400">{new Date(review.created_at).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                      review.phone_verified
                        ? 'bg-brand-50 text-brand-700 border-brand-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                      {review.phone_verified ? '✓' : '○'} Phone {review.phone_verified ? 'Verified' : 'Unverified'}
                    </span>
                    <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {review.identity_level}
                    </span>
                  </div>
                </div>

                {/* ID Image */}
                <div className="bg-gray-50 border-b border-gray-100 flex items-center justify-center" style={{ minHeight: 180 }}>
                  <img
                    src={adminApi.imageUrl(review.id)}
                    alt="Government ID"
                    className="w-full max-h-48 object-contain"
                    onError={e => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = 'none';
                      t.insertAdjacentHTML('afterend', '<p class="text-xs text-gray-400 p-4">Image unavailable</p>');
                    }}
                  />
                </div>

                {/* File name */}
                <div className="px-5 py-2.5 border-b border-gray-100">
                  <p className="text-xs text-gray-400 truncate">📎 {review.file_name}</p>
                </div>

                {/* Actions */}
                <div className="px-5 py-4">
                  {selected === review.id ? (
                    <div className="space-y-3">
                      <input className="input text-sm" type="text" placeholder="Reason for rejection..."
                        value={rejectReason} onChange={e => setRejectReason(e.target.value)} autoFocus/>
                      <div className="flex gap-2">
                        <button className="btn-secondary text-sm flex-1" onClick={() => { setSelected(null); setRejectReason(''); }}>Cancel</button>
                        <button className="btn-danger text-sm flex-1" onClick={() => handleReject(review.id)}>Confirm Reject</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn-secondary text-sm flex-1" onClick={() => setSelected(review.id)}>
                        Reject
                      </button>
                      <button className="btn-primary text-sm flex-1" onClick={() => handleApprove(review.id)}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
