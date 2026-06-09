import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Draggable from 'react-draggable';
import { Document, Page, pdfjs } from 'react-pdf';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { envelopeApi } from '../api/envelopes';
import { SignatureCaptureModal } from '../components/SignatureCaptureModal';
import { Layout } from '../components/Layout';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ── Field types (same set as NewEnvelope) ─────────────────────────────────────
type FieldType =
  | 'signature' | 'initials' | 'date' | 'text'
  | 'name' | 'email' | 'company' | 'title'
  | 'number' | 'checkbox' | 'dropdown' | 'radio' | 'timestamp'
  | 'approve' | 'decline' | 'stamp'
  | 'note' | 'formula' | 'attachment' | 'drawing';

interface PlacedField {
  id: string;
  field_type: FieldType;
  page_number: number;
  x: number;   // % of container
  y: number;
  width: number;
  height: number;
  preview_data: string | null; // drawn sig PNG or auto-fill text
}

// Same FIELD_CONFIG as NewEnvelope
const FIELD_CONFIG: Record<FieldType, { label: string; icon: string; w: number; h: number }> = {
  signature:  { label: 'Sign',        icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', w: 20, h: 6 },
  initials:   { label: 'Initial',     icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', w: 12, h: 5 },
  date:       { label: 'Date',        icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', w: 16, h: 5 },
  timestamp:  { label: 'Timestamp',   icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', w: 20, h: 5 },
  name:       { label: 'Name',        icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z', w: 18, h: 5 },
  email:      { label: 'Email',       icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', w: 22, h: 5 },
  company:    { label: 'Company',     icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', w: 22, h: 5 },
  title:      { label: 'Title',       icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0', w: 18, h: 5 },
  text:       { label: 'Text',        icon: 'M4 6h16M4 12h16M4 18h7', w: 18, h: 5 },
  number:     { label: 'Number',      icon: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14', w: 12, h: 5 },
  checkbox:   { label: 'Checkbox',    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', w: 6, h: 6 },
  dropdown:   { label: 'Dropdown',    icon: 'M8 9l4-4 4 4m0 6l-4 4-4-4', w: 18, h: 5 },
  radio:      { label: 'Radio',       icon: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z', w: 6, h: 6 },
  approve:    { label: 'Approve',     icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z', w: 14, h: 6 },
  decline:    { label: 'Decline',     icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', w: 14, h: 6 },
  stamp:      { label: 'Stamp',       icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', w: 14, h: 6 },
  note:       { label: 'Note',        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', w: 16, h: 6 },
  formula:    { label: 'Formula',     icon: 'M4.871 4A17.926 17.926 0 003 12c0 2.874.673 5.59 1.871 8m14.13 0a17.926 17.926 0 001.87-8c0-2.874-.673-5.59-1.87-8M9 9h1.246a1 1 0 01.961.725l1.586 5.55a1 1 0 00.961.725H15m1-7h-.08a2 2 0 00-1.519.698L9.6 15.302A2 2 0 018.08 16H8', w: 18, h: 5 },
  attachment: { label: 'Attachment',  icon: 'M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13', w: 16, h: 6 },
  drawing:    { label: 'Drawing',     icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', w: 20, h: 6 },
};

const FIELD_COLORS = [
  'border-brand-400 bg-brand-50 text-brand-700',
];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Upload', 'Place Fields & Sign', 'Send'];
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const idx = (i + 1) as 1 | 2 | 3;
        const active = idx === step;
        const done = idx < step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                active ? 'bg-brand-600 text-white' : done ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {done ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                ) : idx}
              </div>
              <span className={`mt-1 text-xs font-medium whitespace-nowrap ${active ? 'text-brand-700' : done ? 'text-brand-500' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mt-[-12px] transition-colors ${done ? 'bg-brand-400' : 'bg-gray-200'}`}/>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SignDocument() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — fields editor
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [activePage, setActivePage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [pdfPageWidth, setPdfPageWidth] = useState(680);
  const pageRef = useRef<HTMLDivElement>(null);

  // Cursor-follow placement mode — cursorX/Y are pixel offsets inside pageRef
  const [pendingPlacement, setPendingPlacement] = useState<{ type: FieldType; cursorX: number; cursorY: number } | null>(null);

  // Signature/Initials capture modal
  const [captureModal, setCaptureModal] = useState<{ fieldId: string; type: 'signature' | 'initials' } | null>(null);

  // Step 3
  const [subject, setSubject] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  // Measure PDF width on resize
  useEffect(() => {
    const measure = () => { if (pageRef.current) setPdfPageWidth(pageRef.current.clientWidth - 4); };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────
  function handleFile(f: File) {
    if (f.type !== 'application/pdf') { toast.error('Please upload a PDF file'); return; }
    setFile(f);
    setSubject(f.name.replace(/\.pdf$/i, ''));
  }

  // ── Field placement ────────────────────────────────────────────────────────
  const activateField = useCallback((type: FieldType) => {
    setPendingPlacement({ type, cursorX: 0, cursorY: 0 });
  }, []);

  const dropField = useCallback((x: number, y: number) => {
    if (!pendingPlacement) return;
    const type = pendingPlacement.type;
    const cfg = FIELD_CONFIG[type];
    const id = `field-${Date.now()}`;

    // Contact-info: auto-fill from logged-in user
    let preview: string | null = null;
    if (type === 'name')      preview = user?.full_name || null;
    else if (type === 'email')     preview = user?.email || null;
    else if (type === 'date' || type === 'timestamp') preview = new Date().toLocaleDateString('en-IN');

    const newField: PlacedField = {
      id, field_type: type, page_number: activePage,
      x, y, width: cfg.w, height: cfg.h, preview_data: preview,
    };

    if (type === 'signature' || type === 'initials') {
      // Place field first, then immediately open capture modal
      setFields(f => [...f, newField]);
      setPendingPlacement(null);
      setCaptureModal({ fieldId: id, type });
    } else {
      setFields(f => [...f, newField]);
      setPendingPlacement(null);
    }
  }, [pendingPlacement, activePage, user]);

  const handleCaptureConfirm = useCallback((base64: string) => {
    if (!captureModal) return;
    setFields(fs => fs.map(f => f.id === captureModal.fieldId ? { ...f, preview_data: base64 } : f));
    setCaptureModal(null);
  }, [captureModal]);

  // ── Step 2 validation ──────────────────────────────────────────────────────
  const unsignedCaptures = fields.filter(
    f => (f.field_type === 'signature' || f.field_type === 'initials') && !f.preview_data
  );
  const canProceed = fields.length > 0 && unsignedCaptures.length === 0;

  // ── Email helpers ──────────────────────────────────────────────────────────
  function addEmail(raw: string) {
    const val = raw.trim().replace(/,+$/, '');
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { toast.error('Invalid email address'); return; }
    if (emails.includes(val)) { setEmailInput(''); return; }
    setEmails(p => [...p, val]);
    setEmailInput('');
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('subject', subject);
      fd.append('fields', JSON.stringify(
        fields.map(f => ({
          pageNumber: f.page_number,
          x: f.x, y: f.y, width: f.width, height: f.height,
          // Backend selfSign accepts fieldType — map to API-accepted types
          fieldType: (['signature','initials','date','text'].includes(f.field_type)
            ? f.field_type : 'text') as 'signature' | 'initials' | 'date' | 'text',
          // signatureData carries the drawn PNG (for sig/initials PKCS#7 embedding)
          signatureData: (f.field_type === 'signature' || f.field_type === 'initials')
            ? f.preview_data ?? undefined : undefined,
          // value carries pre-fill text (email, name, date, etc.)
          value: (f.field_type !== 'signature' && f.field_type !== 'initials')
            ? f.preview_data ?? undefined : undefined,
        }))
      ));
      fd.append('recipientEmails', JSON.stringify(emails));
      const res = await envelopeApi.selfSign(fd);
      toast.success('Document signed with PKCS#7 cryptographic signature!');
      navigate('/envelopes/' + res.data.envelopeId);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error(
          <span>Complete identity verification first.{' '}
            <Link to="/verify-identity" className="underline font-semibold">Verify now</Link>
          </span>
        );
      } else {
        toast.error(err.response?.data?.error || 'Failed to sign document');
      }
    } finally { setSending(false); }
  }

  // ── Step 2: full-screen editor — renders OUTSIDE Layout (same as NewEnvelope) ──
  if (step === 2) {
    return (
      <>

          <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* Top bar */}
            <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="hover:text-gray-600 cursor-pointer" onClick={() => setStep(1)}>Sign Document</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                <span className="text-gray-800 font-medium">Place Fields</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-100 bg-white text-xs text-gray-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
                  100%
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => setStep(1)}>← Back</button>
                <button
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!canProceed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                  disabled={!canProceed}
                  onClick={() => setStep(3)}>
                  {unsignedCaptures.length > 0 ? `Sign ${unsignedCaptures.length} field${unsignedCaptures.length > 1 ? 's' : ''} first` : 'Next →'}
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">

              {/* Left panel */}
              <div className="w-64 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-hidden">
                <div className="px-3 pt-3 pb-2 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">Fields</span>
                    <div className="relative">
                      <svg className="w-3.5 h-3.5 text-gray-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
                      <input className="w-32 pl-6 pr-2 py-1 text-xs border border-gray-100 rounded-lg bg-gray-50 focus:outline-none focus:border-brand-300 text-gray-700" placeholder="Search fields…"/>
                    </div>
                  </div>
                  {/* User badge */}
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold border" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}>
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"/>
                    <span className="truncate">{user?.full_name || 'You'}</span>
                    <span className="ml-auto text-[10px] bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">{user?.identity_level}</span>
                  </div>
                </div>

                {/* Scrollable field categories */}
                <div className="flex-1 overflow-y-auto py-1">
                  {([
                    { label: 'Signature',    types: ['signature','initials','date','timestamp'] as FieldType[] },
                    { label: 'Contact info', types: ['name','email','company','title'] as FieldType[] },
                    { label: 'Inputs',       types: ['text','number','checkbox','dropdown','radio'] as FieldType[] },
                    { label: 'Actions',      types: ['approve','decline','stamp'] as FieldType[] },
                    { label: 'Other',        types: ['note','formula','attachment','drawing'] as FieldType[] },
                  ] as { label: string; types: FieldType[] }[]).map((section, si) => (
                    <React.Fragment key={section.label}>
                      {si > 0 && <div className="h-px bg-gray-50 mx-3"/>}
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1.5">{section.label}</p>
                      <div className="grid grid-cols-2 gap-1 px-2 pb-2">
                        {section.types.map(type => {
                          const cfg = FIELD_CONFIG[type];
                          const isActive = pendingPlacement?.type === type;
                          return (
                            <button key={type}
                              onClick={() => activateField(type)}
                              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all ${isActive ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200 hover:text-gray-700'}`}>
                              <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-green-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                                <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/>
                              </svg>
                              {cfg.label}
                            </button>
                          );
                        })}
                      </div>
                    </React.Fragment>
                  ))}

                  {/* Placed fields list */}
                  {fields.length > 0 && (
                    <>
                      <div className="h-px bg-gray-50 mx-3"/>
                      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                        <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Placed fields</p>
                        <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{fields.length}</span>
                      </div>
                      <div className="px-2 pb-3 space-y-1">
                        {fields.map(f => {
                          const isSigType = f.field_type === 'signature' || f.field_type === 'initials';
                          const needsSig = isSigType && !f.preview_data;
                          return (
                            <div key={f.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border group ${needsSig ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${needsSig ? 'bg-amber-400' : 'bg-green-400'}`}/>
                              <span className="flex-1 text-[11px] text-gray-600 capitalize truncate">{f.field_type} — p.{f.page_number}</span>
                              {needsSig && (
                                <button onClick={() => setCaptureModal({ fieldId: f.id, type: f.field_type as 'signature' | 'initials' })}
                                  className="text-[10px] text-amber-600 hover:text-amber-800 font-medium flex-shrink-0">Sign</button>
                              )}
                              <button onClick={() => setFields(fs => fs.filter(x => x.id !== f.id))}
                                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all ml-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Panel footer */}
                {pendingPlacement && (
                  <div className="px-3 py-2 bg-green-50 border-t border-green-100 flex items-center justify-between flex-shrink-0">
                    <span className="text-[11px] text-green-700 font-medium">Click on document to place</span>
                    <button onClick={() => setPendingPlacement(null)} className="text-[11px] text-green-600 hover:text-red-500 font-medium">✕ Cancel</button>
                  </div>
                )}
                <div className="p-2.5 border-t border-gray-100 flex gap-2 flex-shrink-0">
                  <button className="flex-1 py-2 rounded-lg border border-gray-100 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors" onClick={() => setStep(1)}>← Back</button>
                  <button
                    className={`flex-[2] py-2 rounded-lg text-xs font-semibold transition-colors ${!canProceed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                    disabled={!canProceed} onClick={() => setStep(3)}>
                    {unsignedCaptures.length > 0 ? `Sign ${unsignedCaptures.length} first` : 'Next →'}
                  </button>
                </div>
              </div>

              {/* PDF canvas */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Canvas toolbar */}
                <div className="h-10 bg-white border-b border-gray-100 flex items-center gap-3 px-4 flex-shrink-0">
                  <span className="text-xs text-gray-400 truncate">{file?.name || 'document.pdf'}</span>
                  <div className="w-px h-4 bg-gray-100"/>
                  <span className="text-xs text-gray-400">{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
                  <div className="ml-auto flex gap-1">
                    {Array.from({ length: pageCount }, (_, i) => (
                      <button key={i + 1} onClick={() => setActivePage(i + 1)}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${activePage === i + 1 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'}`}>
                        Page {i + 1}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable canvas */}
                <div
                  className={`flex-1 overflow-auto bg-gray-100 flex justify-center py-6 ${pendingPlacement ? 'cursor-crosshair' : ''}`}
                  tabIndex={-1}
                  onKeyDown={e => { if (e.key === 'Escape') setPendingPlacement(null); }}
                >
                  <div
                    ref={pageRef}
                    className="relative bg-white shadow-md"
                    style={{ width: `${pdfPageWidth}px`, minHeight: '800px' }}
                    onMouseMove={e => {
                      if (!pendingPlacement || !pageRef.current) return;
                      const rect = pageRef.current.getBoundingClientRect();
                      // Store raw pixel position inside pageRef (handles scroll automatically)
                      const xPx = e.clientX - rect.left;
                      const yPx = e.clientY - rect.top;
                      setPendingPlacement(p => p ? { ...p, cursorX: xPx, cursorY: yPx } : null);
                    }}
                    onClick={e => {
                      if (!pendingPlacement || !pageRef.current) return;
                      e.stopPropagation();
                      const rect = pageRef.current.getBoundingClientRect();
                      const pW = pageRef.current.scrollWidth;
                      const pH = pageRef.current.scrollHeight;
                      const cfg = FIELD_CONFIG[pendingPlacement.type];
                      // Convert pixel click to percent, centred on cursor
                      const xPct = ((e.clientX - rect.left) / pW) * 100;
                      const yPct = ((e.clientY - rect.top) / pH) * 100;
                      const x = Math.max(0, Math.min(100 - cfg.w, xPct - cfg.w / 2));
                      const y = Math.max(0, Math.min(100 - cfg.h, yPct - cfg.h / 2));
                      dropField(x, y);
                    }}
                  >
                    {file ? (
                      <Document file={file}
                        onLoadSuccess={({ numPages }) => setPageCount(numPages)}
                        loading={<div className="flex items-center justify-center" style={{ height: '800px' }}><div className="w-8 h-8 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin"/></div>}
                        error={<div className="flex items-center justify-center text-red-400 text-sm" style={{ height: '800px' }}>Failed to load PDF</div>}>
                        <Page pageNumber={activePage} width={pdfPageWidth} renderTextLayer={false} renderAnnotationLayer={false}/>
                      </Document>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-gray-300">
                          <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                          <p className="text-sm">Page {activePage}</p>
                        </div>
                      </div>
                    )}

                    {/* Placed field overlays */}
                    <div className="absolute inset-0 pointer-events-none">
                      {fields.filter(f => f.page_number === activePage).map(field => {
                        const cfg = FIELD_CONFIG[field.field_type] ?? FIELD_CONFIG.text;
                        const isSig = field.field_type === 'signature';
                        const isInit = field.field_type === 'initials';
                        const hasDrawn = !!field.preview_data && (isSig || isInit);
                        const autoText = field.preview_data && !isSig && !isInit ? field.preview_data : null;

                        return (
                          <Draggable key={field.id} bounds="parent"
                            position={{ x: (field.x / 100) * (pageRef.current?.clientWidth || 680), y: (field.y / 100) * (pageRef.current?.scrollHeight || 800) }}
                            onStop={(_, data) => {
                              const pW = pageRef.current?.clientWidth || 680;
                              const pH = pageRef.current?.scrollHeight || 800;
                              setFields(fs => fs.map(f => f.id === field.id ? { ...f, x: (data.x / pW) * 100, y: (data.y / pH) * 100 } : f));
                            }}>
                            <div
                              className="absolute cursor-move select-none pointer-events-auto rounded-sm"
                              style={{
                                width: `${field.width}%`, height: `${field.height}%`,
                                minWidth: isSig ? '80px' : '56px', minHeight: '24px',
                                background: isSig || isInit ? 'rgba(22,163,74,0.07)' : 'rgba(59,130,246,0.07)',
                                border: `1.5px ${(isSig || isInit) && !hasDrawn ? 'dashed' : 'solid'} ${isSig || isInit ? '#16a34a' : '#3b82f6'}`,
                              }}
                              onClick={e => {
                                e.stopPropagation();
                                if (isSig || isInit) setCaptureModal({ fieldId: field.id, type: field.field_type as 'signature' | 'initials' });
                              }}
                            >
                              <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden px-1.5">
                                {/* Delete */}
                                <button className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center z-10"
                                  onClick={e => { e.stopPropagation(); setFields(fs => fs.filter(f => f.id !== field.id)); }}>
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                </button>

                                {/* Drawn signature/initials */}
                                {hasDrawn && (
                                  <img src={field.preview_data!} alt="sig" className="w-full object-contain" style={{ maxHeight: '70%' }}/>
                                )}

                                {/* Unsigned sig/initials — show clickable placeholder */}
                                {(isSig || isInit) && !hasDrawn && (
                                  <div className="flex flex-col items-center justify-center w-full h-full">
                                    <svg className="w-3.5 h-3.5 text-green-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/></svg>
                                    <span className="font-semibold text-green-700 text-center" style={{ fontSize: '8px' }}>{isSig ? 'Click to sign' : 'Click to initial'}</span>
                                  </div>
                                )}

                                {/* Auto-fill text */}
                                {autoText && !isSig && !isInit && (
                                  <span className="text-center leading-tight font-medium truncate w-full text-blue-700" style={{ fontSize: '8px' }}>{autoText}</span>
                                )}

                                {/* Icon + label for other field types */}
                                {!isSig && !isInit && !autoText && (
                                  <>
                                    <svg className="w-3 h-3 opacity-50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/></svg>
                                    <span className="font-semibold truncate w-full text-center text-blue-600" style={{ fontSize: '8px' }}>{cfg.label}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </Draggable>
                        );
                      })}
                    </div>

                    {/* Ghost placeholder — follows cursor exactly in pixel space */}
                    {pendingPlacement && (() => {
                      const cfg = FIELD_CONFIG[pendingPlacement.type];
                      const isSig = pendingPlacement.type === 'signature';
                      const isInit = pendingPlacement.type === 'initials';
                      const pW = pageRef.current?.clientWidth || 680;
                      const pH = pageRef.current?.scrollHeight || 800;
                      // Ghost width/height in pixels
                      const ghostW = (cfg.w / 100) * pW;
                      const ghostH = (cfg.h / 100) * pH;
                      return (
                        <div className="absolute pointer-events-none rounded-sm z-20 opacity-80"
                          style={{
                            // Centre the ghost on the cursor using pixels
                            left: `${pendingPlacement.cursorX - ghostW / 2}px`,
                            top:  `${pendingPlacement.cursorY - ghostH / 2}px`,
                            width: `${ghostW}px`,
                            height: `${ghostH}px`,
                            minWidth: isSig ? '80px' : '56px',
                            minHeight: '24px',
                            background: 'rgba(22,163,74,0.10)',
                            border: '1.5px dashed #16a34a',
                          }}>
                          <div className="w-full h-full flex flex-col items-center justify-center">
                            <svg className="w-3.5 h-3.5 text-green-600 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/></svg>
                            <span className="font-semibold text-green-700 text-center" style={{ fontSize: '8px' }}>
                              {isSig ? 'Sign Here' : isInit ? 'Initial Here' : cfg.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Right thumbnail strip */}
              <div className="w-20 flex-shrink-0 bg-white border-l border-gray-100 flex flex-col items-center py-3 gap-3 overflow-y-auto">
                <span className="text-[9px] font-semibold text-gray-300 uppercase tracking-widest">Pages</span>
                {Array.from({ length: Math.max(pageCount, 1) }, (_, i) => (
                  <button key={i + 1} onClick={() => setActivePage(i + 1)}
                    className={`w-14 rounded border transition-all ${activePage === i + 1 ? 'border-green-400 border-[1.5px]' : 'border-gray-100 hover:border-gray-200'}`}
                    style={{ minHeight: '72px' }}>
                    <div className="p-1.5 space-y-0.5">
                      {[80,60,90,70,85,55,75].map((w, j) => (
                        <div key={j} className="h-1 rounded-sm bg-gray-100" style={{ width: `${w}%`}}/>
                      ))}
                    </div>
                    <span className={`block text-center text-[9px] pb-1 font-medium ${activePage === i + 1 ? 'text-green-600' : 'text-gray-300'}`}>{i + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

        {/* Signature / Initials capture modal */}
        {captureModal && (
          <SignatureCaptureModal
            fieldType={captureModal.type}
            onConfirm={handleCaptureConfirm}
            onCancel={() => setCaptureModal(null)}
          />
        )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign Document</h1>
        <StepIndicator step={step} />

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900 mb-4">Upload your PDF</h2>
            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-400'}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}/>
              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                  </div>
                  <span className="px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-sm font-medium border border-brand-100">{file.name}</span>
                  <p className="text-xs text-gray-400">Click to choose a different file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Drop a PDF here or <span className="text-brand-600 font-semibold">click to browse</span></p>
                  <p className="text-xs text-gray-400">PDF files only</p>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button className="btn-primary" disabled={!file} onClick={() => setStep(2)}>Next →</button>
            </div>
          </div>
        )}



        {/* ── Step 3: Send ── */}
        {step === 3 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-xl" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900 mb-6">Review & Send</h2>
            <div className="space-y-5">
              <div>
                <label className="label">Subject</label>
                <input type="text" className="input w-full mt-1" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Document subject"/>
              </div>
              <div>
                <label className="label">Recipients <span className="text-gray-400 font-normal text-xs">(optional — press Enter to add)</span></label>
                <div className="mt-1 min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 bg-white">
                  {emails.map(em => (
                    <span key={em} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-100">
                      {em}
                      <button type="button" onClick={() => setEmails(p => p.filter(e => e !== em))} className="text-brand-400 hover:text-brand-700">×</button>
                    </span>
                  ))}
                  <input type="email" className="flex-1 min-w-[160px] text-sm outline-none bg-transparent placeholder-gray-400"
                    placeholder={emails.length === 0 ? 'recipient@example.com' : ''}
                    value={emailInput} onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEmail(emailInput); } else if (e.key === 'Backspace' && !emailInput) setEmails(p => p.slice(0, -1)); }}
                    onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}/>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
                <p><span className="font-medium text-gray-900">Document:</span> {file?.name}</p>
                <p><span className="font-medium text-gray-900">Fields placed:</span> {fields.length} ({fields.filter(f => f.field_type === 'signature').length} signature, {fields.filter(f => f.field_type === 'initials').length} initials, {fields.filter(f => f.field_type === 'date').length} date)</p>
                <p><span className="font-medium text-gray-900">PKCS#7 signature:</span> <span className="text-green-600 font-medium">✓ Applied server-side on submission</span></p>
                {emails.length > 0 && <p><span className="font-medium text-gray-900">Recipients:</span> {emails.join(', ')}</p>}
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary" disabled={sending || !subject.trim()} onClick={handleSend}>
                {sending ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending…</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    Send
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signature / Initials capture modal */}
      {captureModal && (
        <SignatureCaptureModal
          fieldType={captureModal.type}
          onConfirm={handleCaptureConfirm}
          onCancel={() => setCaptureModal(null)}
        />
      )}
    </Layout>
  );
}