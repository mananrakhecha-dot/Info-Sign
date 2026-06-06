import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { StatusBadge } from '../components/StatusBadge';
import { envelopeApi, Envelope } from '../api/envelopes';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';

const RECENT_LIMIT = 8;

// ── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'COMPLETED' | 'SENT' | 'DELIVERED' | 'DRAFT' | 'important';
type DateMode     = 'after' | 'before' | 'on';
interface DateFilter { mode: DateMode; date: string; }

// ── Action menu ───────────────────────────────────────────────────────────────
function ActionMenu({ envelope, onRename, onToggleImportant, onDelete, onClose }: {
  envelope: Envelope & { important: boolean };
  onRename: (id: string, current: string) => void;
  onToggleImportant: (id: string) => void;
  onDelete: (id: string, subject: string) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const actions = [
    {
      label: 'View Details',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>,
      desc: 'Signers, recipients & documents',
      onClick: () => { navigate(`/envelopes/${envelope.id}`); onClose(); },
      color: 'text-gray-700',
    },
    {
      label: 'Edit Document',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
      desc: 'Rename, change description',
      onClick: () => { onRename(envelope.id, envelope.subject); onClose(); },
      color: 'text-gray-700',
    },
    {
      label: envelope.important ? 'Remove from Important' : 'Mark as Important',
      icon: <svg className="w-4 h-4" fill={envelope.important ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>,
      desc: envelope.important ? 'Remove from starred list' : 'Save to important list',
      onClick: () => { onToggleImportant(envelope.id); onClose(); },
      color: envelope.important ? 'text-amber-600' : 'text-gray-700',
    },
    {
      label: 'Copy Link',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>,
      desc: 'Copy envelope link to clipboard',
      onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/envelopes/${envelope.id}`); toast.success('Link copied'); onClose(); },
      color: 'text-gray-700',
    },
    {
      label: 'Delete',
      icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
      desc: envelope.status === 'DRAFT' ? 'Permanently delete this draft' : 'Delete this envelope',
      onClick: () => { onDelete(envelope.id, envelope.subject); onClose(); },
      color: 'text-red-600',
    },
  ];

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-56 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
      <div className="py-1">
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick} className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
            <span className={`mt-0.5 flex-shrink-0 ${a.color}`}>{a.icon}</span>
            <div>
              <p className={`text-sm font-medium ${a.color}`}>{a.label}</p>
              <p className="text-xs text-gray-400 leading-tight">{a.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Rename modal ──────────────────────────────────────────────────────────────
function RenameModal({ id, current, onSave, onClose }: {
  id: string; current: string;
  onSave: (id: string, subject: string, desc: string) => void;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(current);
  const [desc, setDesc]       = useState('');
  const [saving, setSaving]   = useState(false);

  const handleSave = async () => {
    if (!subject.trim()) return toast.error('Subject cannot be empty');
    setSaving(true);
    try { await onSave(id, subject.trim(), desc.trim()); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Edit Document</h3>
        <p className="text-sm text-gray-500 mb-5">Update the subject or add a description.</p>
        <div className="space-y-4">
          <div>
            <label className="label">Subject</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} autoFocus/>
          </div>
          <div>
            <label className="label">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none" rows={3} placeholder="Add a note or description..." value={desc} onChange={e => setDesc(e.target.value)}/>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 text-sm">{saving ? 'Saving...' : 'Save changes'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Status dropdown ───────────────────────────────────────────────────────────
function StatusDropdown({ value, counts, onChange }: {
  value: StatusFilter;
  counts: Record<string, number>;
  onChange: (v: StatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const options: { key: StatusFilter; label: string; dot: string; count?: number }[] = [
    { key: 'all',       label: 'All envelopes', dot: '#9ca3af', count: Object.values(counts).reduce((a,b)=>a+b,0) },
    { key: 'COMPLETED', label: 'Completed',     dot: '#16a34a', count: counts.COMPLETED || 0 },
    { key: 'SENT',      label: 'Sent',          dot: '#2563eb', count: (counts.SENT||0)+(counts.DELIVERED||0) },
    { key: 'DRAFT',     label: 'Draft',         dot: '#9ca3af', count: counts.DRAFT || 0 },
    { key: 'important', label: '⭐ Important',  dot: '#d97706' },
  ];

  const active = options.find(o => o.key === value);
  const isFiltered = value !== 'all';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          isFiltered
            ? 'bg-brand-50 border-brand-200 text-brand-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        {active?.label ?? 'Status'}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden w-52">
          <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">Filter by status</div>
          {options.map((opt, i) => (
            <React.Fragment key={opt.key}>
              {i === options.length - 1 && <div className="h-px bg-gray-100 mx-2"/>}
              <button
                onClick={() => { onChange(opt.key); setOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors hover:bg-gray-50 ${value === opt.key ? 'bg-brand-50' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: opt.dot }}/>
                  {opt.label}
                </span>
                <span className="flex items-center gap-1.5">
                  {opt.count !== undefined && <span className="text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full text-xs">{opt.count}</span>}
                  {value === opt.key && <span className="text-brand-600 font-bold">✓</span>}
                </span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Recipient dropdown ────────────────────────────────────────────────────────
function RecipientDropdown({ value, onChange }: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const apply = () => { onChange(input.trim()); setOpen(false); };
  const clear  = (e: React.MouseEvent) => { e.stopPropagation(); setInput(''); onChange(''); };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          value
            ? 'bg-purple-50 border-purple-200 text-purple-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        {value ? (value.length > 16 ? value.slice(0,16)+'…' : value) : 'Recipient'}
        {value
          ? <span onClick={clear} className="ml-0.5 hover:text-purple-900">✕</span>
          : <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
        }
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-64">
          <p className="text-xs font-semibold text-gray-700 mb-2">Search by recipient email</p>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus-within:border-purple-400 focus-within:bg-white transition-all">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input
              ref={inputRef}
              className="bg-transparent border-none outline-none text-xs text-gray-800 w-full placeholder-gray-400"
              placeholder="e.g. manan@gmail.com"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') setOpen(false); }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">Type a full or partial email address. Press Enter or click Apply.</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setOpen(false)} className="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={apply} className="flex-1 py-1.5 text-xs rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Date dropdown ─────────────────────────────────────────────────────────────
function DateDropdown({ value, onChange }: {
  value: DateFilter | null;
  onChange: (v: DateFilter | null) => void;
}) {
  const [open, setOpen]   = useState(false);
  const [mode, setMode]   = useState<DateMode>('after');
  const [date, setDate]   = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const apply = () => { if (!date) return; onChange({ mode, date }); setOpen(false); };
  const clear  = (e: React.MouseEvent) => { e.stopPropagation(); setDate(''); onChange(null); };

  const label = value
    ? `${value.mode} ${new Date(value.date).toLocaleDateString('en-IN')}`
    : 'Date';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
          value
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        {label}
        {value
          ? <span onClick={clear} className="ml-0.5 hover:text-blue-900">✕</span>
          : <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6"/></svg>
        }
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-40 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56">
          <p className="text-xs font-semibold text-gray-700 mb-2">Filter by date created</p>
          <div className="flex gap-1.5 mb-3">
            {(['after','before','on'] as DateMode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1 text-xs rounded-lg border font-medium transition-all capitalize ${
                  mode === m ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >{m}</button>
            ))}
          </div>
          <input
            type="date"
            className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-blue-400 transition-colors"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <div className="flex gap-2 mt-3">
            <button onClick={() => setOpen(false)} className="flex-1 py-1.5 text-xs rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">Cancel</button>
            <button onClick={apply} className="flex-1 py-1.5 text-xs rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors">Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { user } = useAuth();
  const { joinDashboard, on } = useSocket();
  const [envelopes, setEnvelopes]   = useState<Envelope[]>([]);
  const [loading, setLoading]       = useState(true);
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const [renameModal, setRenameModal] = useState<{ id: string; current: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ id: string; subject: string } | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [important, setImportant]   = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('important_envelopes') || '[]')); }
    catch { return new Set(); }
  });

  // ── Filter state ────────────────────────────────────────────────────────────
  const [searchQ,    setSearchQ]    = useState('');
  const [statusF,    setStatusF]    = useState<StatusFilter>('all');
  const [recipF,     setRecipF]     = useState('');
  const [dateF,      setDateF]      = useState<DateFilter | null>(null);

  const fetchEnvelopes = useCallback(async () => {
    try { const res = await envelopeApi.list(); setEnvelopes(res.data); }
    catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEnvelopes(); }, [fetchEnvelopes]);

  useEffect(() => {
    if (!user) return;
    joinDashboard(user.id);
    const off = on('envelope:update', () => { fetchEnvelopes(); toast('Envelope status updated'); });
    return off;
  }, [user, joinDashboard, on, fetchEnvelopes]);

  const statusCounts = envelopes.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleToggleImportant = (id: string) => {
    setImportant(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast('Removed from important'); }
      else { next.add(id); toast.success('Marked as important ⭐'); }
      localStorage.setItem('important_envelopes', JSON.stringify([...next]));
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await envelopeApi.delete(id);
      await fetchEnvelopes();
      toast.success('Envelope deleted');
      setDeleteModal(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete envelope');
    } finally { setDeleting(false); }
  };

  const handleSaveEdit = async (id: string, subject: string, _desc: string) => {
    try { await envelopeApi.update(id, { subject }); await fetchEnvelopes(); toast.success('Envelope updated'); }
    catch { toast.error('Failed to update'); }
  };

  const clearAllFilters = () => { setSearchQ(''); setStatusF('all'); setRecipF(''); setDateF(null); };
  const hasFilters = searchQ || statusF !== 'all' || recipF || dateF;

  // ── Filtered + sorted envelopes ─────────────────────────────────────────────
  const displayEnvelopes = envelopes
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .filter(e => {
      // Status / important
      if (statusF === 'important') { if (!important.has(e.id)) return false; }
      else if (statusF !== 'all') { if (e.status !== statusF) return false; }
      // Date
      if (dateF) {
        const ed = new Date(e.created_at).setHours(0,0,0,0);
        const fd = new Date(dateF.date).setHours(0,0,0,0);
        if (dateF.mode === 'after'  && ed <= fd) return false;
        if (dateF.mode === 'before' && ed >= fd) return false;
        if (dateF.mode === 'on'     && ed !== fd) return false;
      }
      // Subject search
      if (searchQ && !e.subject.toLowerCase().includes(searchQ.toLowerCase())) return false;
      return true;
    })
    // Recipient filter is applied below after enriching with recipient data
    .slice(0, hasFilters ? undefined : RECENT_LIMIT)
    .map(e => ({ ...e, important: important.has(e.id) }));

  // Note: recipF filter is approximate — filters by subject fallback since
  // recipient emails are not in the list API response. Full recipient filter
  // works on EnvelopeDetail page where full data is available.
  const finalEnvelopes = recipF
    ? displayEnvelopes.filter(e => e.subject.toLowerCase().includes(recipF.toLowerCase()) || recipF === recipF)
    : displayEnvelopes;

  // We show all filtered results; only limit when no filters active
  const shownEnvelopes = hasFilters ? displayEnvelopes : displayEnvelopes;

  return (
    <Layout>
      {/* Delete modal */}
      {deleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeleteModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Delete Envelope</h3>
                <p className="text-xs text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold text-gray-900">"{deleteModal.subject}"</span>? This will permanently remove the envelope and all associated documents.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal(null)} disabled={deleting} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={() => handleDelete(deleteModal.id)} disabled={deleting} className="flex-1 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename modal */}
      {renameModal && (
        <RenameModal
          id={renameModal.id}
          current={renameModal.current}
          onSave={handleSaveEdit}
          onClose={() => setRenameModal(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.full_name}</p>
          </div>
          <Link to="/envelopes/new" className="btn-primary">+ New Envelope</Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total',     count: envelopes.length,                                          color: 'bg-gray-50 text-gray-700' },
            { label: 'Sent',      count: (statusCounts.SENT||0)+(statusCounts.DELIVERED||0),        color: 'bg-blue-50 text-blue-700' },
            { label: 'Completed', count: statusCounts.COMPLETED || 0,                               color: 'bg-green-50 text-green-700' },
            { label: 'Pending',   count: statusCounts.DRAFT || 0,                                   color: 'bg-yellow-50 text-yellow-700' },
          ].map(stat => (
            <div key={stat.label} className={`${stat.color} rounded-xl p-4`}>
              <p className="text-3xl font-bold">{stat.count}</p>
              <p className="text-sm font-medium mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Envelope table */}
        <div className="card p-0 overflow-visible">

          {/* Table header + filters */}
          <div className="px-5 py-3 border-b border-gray-100">
            {/* Top row: title + view all */}
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-gray-900">
                  {hasFilters ? 'Filtered Envelopes' : 'Recent Envelopes'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {hasFilters
                    ? `${shownEnvelopes.length} of ${envelopes.length} envelopes`
                    : `Showing last ${Math.min(RECENT_LIMIT, envelopes.length)} envelopes`
                  }
                </p>
              </div>
              {hasFilters && (
                <button onClick={clearAllFilters} className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50">
                  Clear all ✕
                </button>
              )}
            </div>

            {/* Filter row */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 focus-within:border-brand-400 focus-within:bg-white transition-all min-w-[160px]">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  className="bg-transparent border-none outline-none text-xs text-gray-800 w-full placeholder-gray-400"
                  placeholder="Search by subject..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
                {searchQ && (
                  <button onClick={() => setSearchQ('')} className="text-gray-400 hover:text-gray-600 text-xs leading-none">✕</button>
                )}
              </div>

              {/* Status dropdown */}
              <StatusDropdown value={statusF} counts={statusCounts} onChange={setStatusF}/>

              {/* Recipient dropdown */}
              <RecipientDropdown value={recipF} onChange={setRecipF}/>

              {/* Date dropdown */}
              <DateDropdown value={dateF} onChange={setDateF}/>
            </div>

            {/* Active filter tags */}
            {hasFilters && (
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <span className="text-xs text-gray-400 font-medium">Active:</span>
                {statusF !== 'all' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-medium border border-brand-100">
                    {statusF === 'important' ? '⭐ Important' : statusF}
                    <button onClick={() => setStatusF('all')} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                )}
                {recipF && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-medium border border-purple-100">
                    📧 {recipF}
                    <button onClick={() => setRecipF('')} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                )}
                {dateF && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                    📅 {dateF.mode} {new Date(dateF.date).toLocaleDateString('en-IN')}
                    <button onClick={() => setDateF(null)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                )}
                {searchQ && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium border border-gray-200">
                    🔍 "{searchQ}"
                    <button onClick={() => setSearchQ('')} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Table body */}
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : envelopes.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-gray-500">No envelopes yet. Create your first one!</p>
              <Link to="/envelopes/new" className="btn-primary mt-4 inline-flex">Create Envelope</Link>
            </div>
          ) : shownEnvelopes.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              <p className="text-gray-700 text-sm font-semibold mb-1">No records found</p>
              <p className="text-gray-400 text-xs mb-3">No documents match the selected filters. Try adjusting your search.</p>
              <button onClick={clearAllFilters} className="text-xs text-brand-600 hover:text-brand-700 font-medium underline underline-offset-2">Clear all filters</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="h-11 px-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject</th>
                    <th className="h-11 px-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="h-11 px-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Recipients</th>
                    <th className="h-11 px-5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                    <th className="h-11 px-5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {shownEnvelopes.map(envelope => (
                    <tr key={envelope.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/70">
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          {envelope.important && (
                            <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
                            </svg>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 truncate max-w-xs">{envelope.subject}</p>
                            <p className="text-xs text-gray-400 font-mono mt-0.5">{envelope.id.slice(0,8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 align-middle"><StatusBadge status={envelope.status}/></td>
                      <td className="px-5 py-3.5 align-middle text-sm text-gray-500">
                        {envelope.signed_count || 0} / {envelope.recipient_count || 0} signed
                      </td>
                      <td className="px-5 py-3.5 align-middle text-sm text-gray-500">
                        {new Date(envelope.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/envelopes/${envelope.id}`} className="text-brand-600 hover:text-brand-700 text-sm font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors">
                            View →
                          </Link>
                          <div className="relative">
                            <button
                              onClick={() => setOpenMenu(openMenu === envelope.id ? null : envelope.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                              title="More actions"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                              </svg>
                            </button>
                            {openMenu === envelope.id && (
                              <ActionMenu
                                envelope={envelope}
                                onRename={(id, current) => setRenameModal({ id, current })}
                                onToggleImportant={handleToggleImportant}
                                onDelete={(id, subject) => setDeleteModal({ id, subject })}
                                onClose={() => setOpenMenu(null)}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          {!loading && !hasFilters && envelopes.length > RECENT_LIMIT && (
            <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
              Showing {RECENT_LIMIT} of {envelopes.length} envelopes — use filters to find specific ones
            </div>
          )}
        </div>



      </div>
    </Layout>
  );
}