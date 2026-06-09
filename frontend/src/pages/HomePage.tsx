import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';
import { envelopeApi, Envelope } from '../api/envelopes';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, delay }: {
  label: string; value: number | string; icon: React.ReactNode;
  color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md hover:border-gray-200 transition-all duration-200"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-1 font-medium">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Activity item ─────────────────────────────────────────────────────────────
function ActivityItem({ envelope, delay }: { envelope: Envelope; delay: number }) {
  const navigate = useNavigate();
  const statusConfig: Record<string, { dot: string; label: string }> = {
    COMPLETED: { dot: 'bg-emerald-500', label: 'Completed' },
    SENT:      { dot: 'bg-blue-500',    label: 'Sent' },
    DELIVERED: { dot: 'bg-violet-500',  label: 'Delivered' },
    DRAFT:     { dot: 'bg-gray-300',    label: 'Draft' },
    DECLINED:  { dot: 'bg-red-400',     label: 'Declined' },
    VOIDED:    { dot: 'bg-orange-400',  label: 'Voided' },
  };
  const cfg = statusConfig[envelope.status] ?? { dot: 'bg-gray-300', label: envelope.status };
  const date = new Date(envelope.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <motion.button
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.42 + delay * 0.07, duration: 0.35 }}
      onClick={() => navigate(`/envelopes/${envelope.id}`)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate group-hover:text-brand-700 transition-colors">{envelope.subject}</p>
        <p className="text-xs text-gray-400 mt-0.5">{date}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        <span className="text-xs text-gray-500 font-medium">{cfg.label}</span>
      </div>
    </motion.button>
  );
}

// ── Quick action card ─────────────────────────────────────────────────────────
function QuickActionCard({ title, description, icon, iconBg, ctaText, ctaColor, onClick, badge, delay }: {
  title: string; description: string; icon: React.ReactNode;
  iconBg: string; ctaText: string; ctaColor: string; onClick: () => void;
  badge?: { text: string; color: string } | null; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      className="bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-5 shadow-sm hover:shadow-lg hover:border-gray-200 transition-shadow duration-200 cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-gray-900 mb-1.5">{title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
      </div>
      <button
        className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-150 group-hover:gap-2.5 ${ctaColor}`}
        onClick={e => { e.stopPropagation(); onClick(); }}
      >
        <span>{ctaText}</span>
        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd"/>
        </svg>
      </button>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    envelopeApi.list().then(res => setEnvelopes(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const stats = {
    total:     envelopes.length,
    completed: envelopes.filter(e => e.status === 'COMPLETED').length,
    pending:   envelopes.filter(e => ['SENT', 'DELIVERED'].includes(e.status)).length,
    drafts:    envelopes.filter(e => e.status === 'DRAFT').length,
  };

  const recent = envelopes
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const needsVerify = user?.identity_level === 'NONE';

  return (
    <Layout>
      {/* ── Hero banner ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl overflow-hidden mb-7"
        style={{ background: 'linear-gradient(135deg, #15803d 0%, #16a34a 40%, #059669 70%, #0d9488 100%)' }}
      >
        {/* dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        {/* animated glow blobs */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.18, 0.28, 0.18] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-10 -right-10 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 70%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.08, 1], opacity: [0.12, 0.2, 0.12] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%)' }}
        />

        <div className="relative px-8 py-10 flex items-center justify-between">
          <div>
            <motion.p
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-sm font-medium mb-1"
              style={{ color: 'rgba(255,255,255,0.75)' }}
            >
              {greeting} ☀️
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              className="text-3xl font-bold text-white tracking-tight"
            >
              {firstName}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-sm mt-2"
              style={{ color: 'rgba(255,255,255,0.72)' }}
            >
              {needsVerify
                ? 'Verify your identity to start signing documents'
                : `You have ${stats.pending} document${stats.pending !== 1 ? 's' : ''} awaiting signatures`}
            </motion.p>

            {needsVerify && (
              <motion.div
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42, duration: 0.35 }}
                className="mt-4"
              >
                <Link
                  to="/verify-identity"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-150 hover:opacity-90"
                  style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.25)' }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                  </svg>
                  Verify identity now
                </Link>
              </motion.div>
            )}
          </div>

          {/* identity shield */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, duration: 0.4, type: 'spring', stiffness: 200 }}
            className="hidden sm:flex flex-col items-center gap-1.5 flex-shrink-0"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(255,255,255,0.25)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-white" style={{ opacity: 0.85 }}>
              {user?.identity_level ?? 'NONE'} level
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard delay={0.08} label="Total documents" value={loading ? '—' : stats.total}
          color="bg-brand-50 text-brand-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>}
        />
        <StatCard delay={0.16} label="Completed" value={loading ? '—' : stats.completed}
          color="bg-emerald-50 text-emerald-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard delay={0.24} label="Awaiting signatures" value={loading ? '—' : stats.pending}
          color="bg-blue-50 text-blue-600"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatCard delay={0.32} label="Drafts" value={loading ? '—' : stats.drafts}
          color="bg-gray-100 text-gray-500"
          icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>}
        />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Quick actions — 3 cols */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.3 }}
            className="text-xs font-semibold text-gray-400 uppercase tracking-widest"
          >
            Quick actions
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickActionCard
              delay={0.38}
              title="Sign a document"
              description="Upload a PDF and apply your cryptographic digital signature — verifiable in Adobe Acrobat."
              iconBg="bg-brand-50"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>}
              ctaText="Start signing"
              ctaColor="text-brand-600 hover:text-brand-700"
              onClick={() => navigate(needsVerify ? '/verify-identity' : '/sign-document')}
              badge={needsVerify ? { text: 'Verify first', color: 'bg-amber-50 text-amber-600 border border-amber-100' } : null}
            />
            <QuickActionCard
              delay={0.46}
              title="Send for signatures"
              description="Create an envelope, add recipients, place signature fields, and track progress in real time."
              iconBg="bg-blue-50"
              icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>}
              ctaText="New envelope"
              ctaColor="text-blue-600 hover:text-blue-700"
              onClick={() => navigate('/envelopes/new')}
              badge={null}
            />
          </div>

          {/* Trust features strip */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 px-5 py-4 grid grid-cols-3 gap-4"
          >
            {[
              { icon: '🔒', label: 'AES-256 encryption', sub: 'All files encrypted at rest' },
              { icon: '📜', label: 'PKI certificate chain', sub: 'Root → Intermediate → User' },
              { icon: '⚡', label: 'Real-time tracking', sub: 'Socket.IO live updates' },
            ].map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.07, duration: 0.35 }}
                className="flex flex-col items-center text-center gap-1.5 py-1"
              >
                <span className="text-xl">{f.icon}</span>
                <p className="text-xs font-semibold text-gray-700">{f.label}</p>
                <p className="text-[10px] text-gray-400 leading-snug">{f.sub}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Recent activity — 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35, duration: 0.3 }}
              className="text-xs font-semibold text-gray-400 uppercase tracking-widest"
            >
              Recent activity
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.3 }}>
              <Link to="/dashboard" className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
                View all →
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
          >
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-8 h-8 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-3 rounded w-3/4" />
                      <div className="skeleton h-2.5 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">No documents yet</p>
                <p className="text-xs text-gray-400 mt-1">Send your first envelope to get started</p>
                <button onClick={() => navigate('/envelopes/new')} className="mt-4 btn-primary text-xs px-3 py-1.5">
                  Send now →
                </button>
              </div>
            ) : (
              <div className="p-2">
                {recent.map((env, i) => <ActivityItem key={env.id} envelope={env} delay={i} />)}
              </div>
            )}
          </motion.div>

          {/* Identity level card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.4 }}
            className="bg-white rounded-2xl border border-gray-100 p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${needsVerify ? 'bg-amber-50' : 'bg-brand-50'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={`w-5 h-5 ${needsVerify ? 'text-amber-500' : 'text-brand-600'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Identity level</p>
                <p className="text-xs text-gray-400">
                  {user?.identity_level === 'AES'
                    ? 'Full assurance — all docs unlocked'
                    : user?.identity_level === 'SES'
                    ? 'Standard — email verified'
                    : 'Not verified yet'}
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-3">
              {(['NONE', 'SES', 'AES'] as const).map((lvl, i) => {
                const levels = { NONE: 0, SES: 1, AES: 2 };
                const current = levels[(user?.identity_level as keyof typeof levels) ?? 'NONE'];
                const done = i <= current;
                return (
                  <React.Fragment key={lvl}>
                    <div className={`flex-1 h-1.5 rounded-full transition-all duration-700 ${done ? 'bg-brand-500' : 'bg-gray-100'}`} />
                    {i < 2 && <span className="text-[9px] text-gray-200">|</span>}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between mt-1.5">
              {['NONE', 'SES', 'AES'].map(lvl => (
                <span key={lvl} className={`text-[10px] font-semibold ${lvl === user?.identity_level ? 'text-brand-600' : 'text-gray-300'}`}>{lvl}</span>
              ))}
            </div>

            {user?.identity_level !== 'AES' && (
              <Link
                to="/verify-identity"
                className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors duration-150"
              >
                Upgrade verification →
              </Link>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}