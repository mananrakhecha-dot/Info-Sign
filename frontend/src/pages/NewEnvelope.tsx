import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import { Document, Page, pdfjs } from 'react-pdf';
import { envelopeApi, SignatureField } from '../api/envelopes';
import { Layout } from '../components/Layout';
import { SignatureCaptureModal } from '../components/SignatureCaptureModal';
import toast from 'react-hot-toast';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type WizardStep = 'upload' | 'recipients' | 'fields' | 'review';

interface RecipientForm {
  email: string;
  full_name: string;
  order_index: number;
  auth_required: 'SES' | 'AES';
}

type FieldType =
  | 'signature' | 'initials' | 'date' | 'text'
  | 'name' | 'email' | 'company' | 'title'
  | 'number' | 'checkbox' | 'dropdown' | 'radio' | 'timestamp'
  | 'approve' | 'decline' | 'stamp'
  | 'note' | 'formula' | 'attachment' | 'drawing';

interface FieldOnPage {
  id: string;
  field_type: FieldType;
  recipient_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  preview_data?: string | null;
}

// Config: icon path, label, default size, colour hint
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

// Which field types are contact-info auto-fills
const CONTACT_FIELD_MAP: Partial<Record<FieldType, keyof RecipientForm>> = {
  name: 'full_name', email: 'email',
};

const FIELD_COLORS = [
  'border-blue-400 bg-blue-50 text-blue-700',
  'border-purple-400 bg-purple-50 text-purple-700',
  'border-orange-400 bg-orange-50 text-orange-700',
  'border-pink-400 bg-pink-50 text-pink-700',
];

const RECIPIENT_BADGE_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-300',
  'bg-purple-100 text-purple-700 border-purple-300',
  'bg-orange-100 text-orange-700 border-orange-300',
  'bg-pink-100 text-pink-700 border-pink-300',
];

export function NewEnvelope() {
  const navigate = useNavigate();
  const [step, setStep] = useState<WizardStep>('upload');
  const [loading, setLoading] = useState(false);

  // Upload step
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [envelopeId, setEnvelopeId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [pdfPageWidth, setPdfPageWidth] = useState(600);

  useEffect(() => {
    const measure = () => {
      if (pageRef.current) setPdfPageWidth(pageRef.current.clientWidth - 4);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Recipients step
  const [recipients, setRecipients] = useState<RecipientForm[]>([
    { email: '', full_name: '', order_index: 1, auth_required: 'SES' }
  ]);

  // Fields step
  const [fields, setFields] = useState<FieldOnPage[]>([]);
  const [activeFieldType, setActiveFieldType] = useState<FieldType>('signature');
  const [activeRecipient, setActiveRecipient] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const pageRef = useRef<HTMLDivElement>(null);

  // Cursor-follow placement state: when not null, a ghost placeholder follows the mouse
  const [pendingPlacement, setPendingPlacement] = useState<{ type: FieldType; cursorX: number; cursorY: number } | null>(null);

  // Signature capture modal — NOT used by sender; only for recipient in SigningCeremony
  const [captureModalOpen] = useState(false);
  const pendingFieldRef = useRef<Omit<FieldOnPage, 'preview_data'> | null>(null);
  const handleCaptureConfirm = useCallback((_base64: string) => {}, []);
  const handleCaptureCancel = useCallback(() => {}, []);

  // ── FIX 1: Compute which recipients have no fields assigned ──────────────
  const recipientsWithNoFields = recipients
    .map((r, i) => ({ index: i, name: r.full_name || `Recipient ${i + 1}` }))
    .filter(r => !fields.some(f => f.recipient_index === r.index));

  // Upload + create envelope
  const handleUpload = async () => {
    if (!pdfFile || !subject) { toast.error('Subject and PDF required'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('document', pdfFile);
      fd.append('subject', subject);
      fd.append('message', message);
      const res = await envelopeApi.create(fd);
      setEnvelopeId(res.data.envelopeId);
      setDocumentId(res.data.documentId);
      setPageCount(res.data.pageCount);
      toast.success('Document uploaded');
      setStep('recipients');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally { setLoading(false); }
  };

  // Save recipients
  const handleSaveRecipients = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const r of recipients) {
      if (!r.email || !r.full_name) { toast.error('All recipient fields required'); return; }
      if (!emailRegex.test(r.email)) { toast.error(`Invalid email address: ${r.email}`); return; }
    }
    setLoading(true);
    try {
      await envelopeApi.updateRecipients(envelopeId, recipients);
      toast.success('Recipients saved');
      setStep('fields');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save recipients');
    } finally { setLoading(false); }
  };

  // Activate cursor-follow placement mode — ghost placeholder follows mouse until click
  const addField = useCallback((overrideType?: FieldType) => {
    const fieldType = overrideType ?? activeFieldType;
    setActiveFieldType(fieldType);
    setPendingPlacement({ type: fieldType, cursorX: 0, cursorY: 0 });
  }, [activeFieldType]);

  // Drop field at the clicked position on the PDF canvas
  const dropField = useCallback((x: number, y: number) => {
    if (!pendingPlacement) return;
    const fieldType = pendingPlacement.type;
    const cfg = FIELD_CONFIG[fieldType];
    const base: FieldOnPage = {
      id: `field-${Date.now()}`,
      field_type: fieldType,
      recipient_index: activeRecipient,
      x,
      y,
      width: cfg.w,
      height: cfg.h,
      page_number: activePage,
      preview_data: null,
    };
    const contactKey = CONTACT_FIELD_MAP[fieldType];
    if (contactKey) {
      base.preview_data = (recipients[activeRecipient]?.[contactKey] as string) || null;
    } else if (fieldType === 'date' || fieldType === 'timestamp') {
      base.preview_data = new Date().toLocaleDateString('en-IN');
    }
    setFields(f => [...f, base]);
    setPendingPlacement(null);
    if (recipients.length > 1) {
      setActiveRecipient(prev => (prev + 1) % recipients.length);
    }
  }, [pendingPlacement, activeRecipient, activePage, recipients]);

  // Save fields — FIX 1: Block if any recipient has no fields
  const handleSaveFields = async () => {
    if (fields.length === 0) { toast.error('Add at least one signature field'); return; }

    // Block if any recipient has zero fields assigned
    if (recipientsWithNoFields.length > 0) {
      const names = recipientsWithNoFields.map(r => r.name).join(', ');
      toast.error(`These recipients have no fields assigned: ${names}. Every recipient needs at least one field.`);
      return;
    }

    setLoading(true);
    try {
      const detail = await envelopeApi.get(envelopeId);
      const fieldPayload: SignatureField[] = fields.map(f => ({
        envelope_document_id: documentId,
        recipient_id: detail.data.recipients[f.recipient_index]?.id || '',
        page_number: f.page_number,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        field_type: (['signature','initials','date','text'].includes(f.field_type)
          ? f.field_type
          : 'text') as 'signature' | 'initials' | 'date' | 'text',
        preview_data: f.preview_data ?? null,
      }));
      await envelopeApi.saveFields(envelopeId, fieldPayload);
      toast.success('Fields saved');
      setStep('review');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save fields');
    } finally { setLoading(false); }
  };

  // Send envelope
  const handleSend = async () => {
    setLoading(true);
    try {
      await envelopeApi.send(envelopeId);
      toast.success('Envelope sent! Recipients will receive signing invitations.');
      navigate(`/envelopes/${envelopeId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send envelope');
    } finally { setLoading(false); }
  };

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'recipients', label: 'Recipients' },
    { id: 'fields', label: 'Place Fields' },
    { id: 'review', label: 'Review & Send' },
  ];

  // ── Step 3: full-screen editor — renders OUTSIDE Layout ──────────────────
  if (step === 'fields') {
    return (
      <>
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

          {/* Top bar */}
          <div className="h-12 bg-white border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="hover:text-gray-600 cursor-pointer" onClick={() => setStep('recipients')}>Set up envelope</span>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              <span className="text-gray-800 font-medium">Add fields</span>
            </div>
            <div className="flex items-center gap-1">
              {[
                { title: 'Undo', d: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3' },
                { title: 'Redo', d: 'M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3' },
              ].map(({ title, d }) => (
                <button key={title} title={title} className="w-7 h-7 rounded-lg border border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:bg-gray-50 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>
                </button>
              ))}
              <div className="w-px h-5 bg-gray-100 mx-1" />
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-gray-100 bg-white text-xs text-gray-600">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
                100%
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors" onClick={() => setStep('recipients')}>← Back</button>
              <button
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${fields.length === 0 || recipientsWithNoFields.length > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                onClick={handleSaveFields} disabled={loading || fields.length === 0 || recipientsWithNoFields.length > 0}>
                {loading ? 'Saving…' : 'Save & Review →'}
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
                    <input className="w-32 pl-6 pr-2 py-1 text-xs border border-gray-100 rounded-lg bg-gray-50 focus:outline-none focus:border-brand-300 focus:bg-white text-gray-700" placeholder="Search fields…" />
                  </div>
                </div>
                <div className="relative">
                  <select className="w-full appearance-none pl-8 pr-7 py-2 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none transition-colors"
                    style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
                    value={activeRecipient} onChange={e => setActiveRecipient(Number(e.target.value))}>
                    {recipients.map((r, i) => <option key={i} value={i}>{r.full_name || `Recipient ${i + 1}`}</option>)}
                  </select>
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-green-500 pointer-events-none" />
                  <svg className="w-3 h-3 text-green-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1">
                {/* Signature */}
                {/* Render all field category sections from FIELD_CONFIG */}
                {([
                  { label: 'Signature',     types: ['signature','initials','date','timestamp'] as FieldType[] },
                  { label: 'Contact info',  types: ['name','email','company','title'] as FieldType[] },
                  { label: 'Inputs',        types: ['text','number','checkbox','dropdown','radio'] as FieldType[] },
                  { label: 'Actions',       types: ['approve','decline','stamp'] as FieldType[] },
                  { label: 'Other',         types: ['note','formula','attachment','drawing'] as FieldType[] },
                ] as { label: string; types: FieldType[] }[]).map((section, si) => (
                  <React.Fragment key={section.label}>
                    {si > 0 && <div className="h-px bg-gray-50 mx-3" />}
                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest px-3 pt-3 pb-1.5">{section.label}</p>
                    <div className="grid grid-cols-2 gap-1 px-2 pb-2">
                      {section.types.map(type => {
                        const cfg = FIELD_CONFIG[type];
                        const isActive = activeFieldType === type;
                        return (
                          <button key={type}
                            onClick={() => { setActiveFieldType(type); addField(type); }}
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

                {/* Placed fields */}
                {fields.length > 0 && (
                  <>
                    <div className="h-px bg-gray-50 mx-3" />
                    <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
                      <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Placed fields</p>
                      <span className="text-[9px] font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">{fields.length}</span>
                    </div>
                    <div className="px-2 pb-3 space-y-1">
                      {fields.map(f => {
                        const dotColors = ['bg-blue-400','bg-purple-400','bg-orange-400','bg-pink-400'];
                        return (
                          <div key={f.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-gray-100 bg-white group">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColors[f.recipient_index % dotColors.length]}`} />
                            <span className="flex-1 text-[11px] text-gray-600 capitalize truncate">{f.field_type} — p.{f.page_number}</span>
                            <span className="text-[10px] text-gray-400 truncate max-w-[50px]">{recipients[f.recipient_index]?.full_name?.split(' ')[0]}</span>
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
                  <span className="text-[11px] text-green-700 font-medium">Click on the document to place</span>
                  <button onClick={() => setPendingPlacement(null)} className="text-[11px] text-green-600 hover:text-red-500 font-medium transition-colors">✕ Cancel</button>
                </div>
              )}
              <div className="p-2.5 border-t border-gray-100 flex gap-2 flex-shrink-0">
                <button className="flex-1 py-2 rounded-lg border border-gray-100 bg-white text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors" onClick={() => setStep('recipients')}>← Back</button>
                <button
                  className={`flex-[2] py-2 rounded-lg text-xs font-semibold transition-colors ${fields.length === 0 || recipientsWithNoFields.length > 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                  onClick={handleSaveFields} disabled={loading || fields.length === 0 || recipientsWithNoFields.length > 0}>
                  {loading ? 'Saving…' : 'Save & Review →'}
                </button>
              </div>
            </div>

            {/* PDF canvas */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="h-10 bg-white border-b border-gray-100 flex items-center gap-3 px-4 flex-shrink-0">
                <span className="text-xs text-gray-400 truncate">{pdfFile?.name || 'document.pdf'}</span>
                <div className="w-px h-4 bg-gray-100" />
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
              <div
                className={`flex-1 overflow-auto bg-gray-100 flex justify-center py-6 ${pendingPlacement ? 'cursor-crosshair' : ''}`}
                onKeyDown={e => { if (e.key === 'Escape') setPendingPlacement(null); }}
                tabIndex={-1}
              >
                <div
                  ref={pageRef}
                  className="relative bg-white shadow-md"
                  style={{ width: `${pdfPageWidth}px`, minHeight: '800px' }}
                  onMouseMove={e => {
                    if (!pendingPlacement || !pageRef.current) return;
                    const rect = pageRef.current.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setPendingPlacement(p => p ? { ...p, cursorX: x, cursorY: y } : null);
                  }}
                  onClick={e => {
                    if (!pendingPlacement || !pageRef.current) return;
                    e.stopPropagation();
                    const rect = pageRef.current.getBoundingClientRect();
                    const cfg = FIELD_CONFIG[pendingPlacement.type];
                    const x = Math.max(0, Math.min(100 - cfg.w, ((e.clientX - rect.left) / rect.width) * 100 - cfg.w / 2));
                    const y = Math.max(0, Math.min(100 - cfg.h, ((e.clientY - rect.top) / rect.height) * 100 - cfg.h / 2));
                    dropField(x, y);
                  }}
                >
                  {pdfFile ? (
                    <Document file={pdfFile}
                      loading={<div className="flex items-center justify-center" style={{ height: '800px' }}><div className="w-8 h-8 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin"/></div>}
                      error={<div className="flex items-center justify-center text-red-400 text-sm" style={{ height: '800px' }}>Failed to load PDF</div>}>
                      <Page pageNumber={activePage} width={pdfPageWidth} renderTextLayer={false} renderAnnotationLayer={false}/>
                    </Document>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-300">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                        <p className="text-sm">Page {activePage} of {pageCount}</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 pointer-events-none">
                    {fields.filter(f => f.page_number === activePage).map(field => {
                      const cfg = FIELD_CONFIG[field.field_type] ?? FIELD_CONFIG.text;
                      const isSig = field.field_type === 'signature';
                      const isInitial = field.field_type === 'initials';
                      const autoText = field.preview_data && !isSig && !isInitial ? field.preview_data : null;
                      const recip = recipients[field.recipient_index];
                      const borderColor = isSig || isInitial
                        ? ['border-blue-400','border-purple-400','border-orange-400','border-pink-400'][field.recipient_index % 4]
                        : FIELD_COLORS[field.recipient_index % FIELD_COLORS.length];

                      return (
                        <Draggable key={field.id} bounds="parent"
                          position={{ x: (field.x / 100) * (pageRef.current?.clientWidth || 600), y: (field.y / 100) * (pageRef.current?.clientHeight || 800) }}
                          onStop={(_, data) => {
                            const pW = pageRef.current?.clientWidth || 600;
                            const pH = pageRef.current?.clientHeight || 800;
                            setFields(fs => fs.map(f => f.id === field.id ? { ...f, x: (data.x / pW) * 100, y: (data.y / pH) * 100 } : f));
                          }}>
                          <div
                            className={`absolute cursor-move select-none pointer-events-auto rounded-sm ${isSig || isInitial ? '' : 'border-2 ' + FIELD_COLORS[field.recipient_index % FIELD_COLORS.length]}`}
                            style={{
                              width: `${field.width}%`,
                              height: `${field.height}%`,
                              minWidth: isSig ? '80px' : isInitial ? '60px' : '56px',
                              minHeight: isSig ? '32px' : '24px',
                              ...(isSig || isInitial ? {
                                background: 'rgba(22,163,74,0.07)',
                                border: '1.5px solid #16a34a',
                              } : {}),
                            }}>
                            <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden">
                              {/* Delete button */}
                              <button
                                className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center z-10"
                                onClick={e => { e.stopPropagation(); setFields(fs => fs.filter(f => f.id !== field.id)); }}>
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                              </button>

                              {/* Signature placeholder — DocuSign style */}
                              {isSig && (
                                <div className="flex flex-col items-center justify-center w-full h-full px-1.5">
                                  <svg className="w-3.5 h-3.5 text-green-600 mb-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                  <span className="font-semibold text-green-700 text-center leading-none" style={{ fontSize: '8px' }}>Sign Here</span>
                                  <span className="text-green-500 text-center leading-none mt-0.5" style={{ fontSize: '7px' }}>{recip?.full_name?.split(' ')[0] || `R${field.recipient_index + 1}`}</span>
                                </div>
                              )}

                              {/* Initials placeholder */}
                              {isInitial && (
                                <div className="flex flex-col items-center justify-center w-full h-full px-1">
                                  <svg className="w-3 h-3 text-green-600 mb-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/></svg>
                                  <span className="font-semibold text-green-700 text-center leading-none" style={{ fontSize: '8px' }}>Initial Here</span>
                                  <span className="text-green-500 text-center leading-none mt-0.5" style={{ fontSize: '7px' }}>{recip?.full_name?.split(' ')[0] || `R${field.recipient_index + 1}`}</span>
                                </div>
                              )}

                              {/* Other fields — auto-fill text or icon+label */}
                              {!isSig && !isInitial && (
                                <div className="flex flex-col items-center justify-center w-full h-full px-1.5 gap-0.5">
                                  {autoText ? (
                                    <span className="text-center leading-tight font-medium truncate w-full" style={{ fontSize: '8px' }}>{autoText}</span>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 opacity-50 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/></svg>
                                      <span className="font-semibold truncate w-full text-center" style={{ fontSize: '8px' }}>{cfg.label}</span>
                                    </>
                                  )}
                                  <span className="opacity-40 truncate w-full text-center" style={{ fontSize: '7px' }}>{recip?.full_name?.split(' ')[0] || `R${field.recipient_index + 1}`}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </Draggable>
                      );
                    })}
                  </div>

                  {/* Ghost placeholder — follows cursor in placement mode */}
                  {pendingPlacement && (() => {
                    const cfg = FIELD_CONFIG[pendingPlacement.type];
                    const isSig = pendingPlacement.type === 'signature';
                    const isInit = pendingPlacement.type === 'initials';
                    return (
                      <div
                        className="absolute pointer-events-none rounded-sm z-20 opacity-80"
                        style={{
                          left: `${pendingPlacement.cursorX - cfg.w / 2}%`,
                          top: `${pendingPlacement.cursorY - cfg.h / 2}%`,
                          width: `${cfg.w}%`,
                          height: `${cfg.h}%`,
                          minWidth: isSig ? '80px' : '56px',
                          minHeight: '24px',
                          background: 'rgba(22,163,74,0.10)',
                          border: '1.5px dashed #16a34a',
                        }}
                      >
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-green-600 mb-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon}/>
                          </svg>
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
                    {[80, 60, 90, 70, 85, 55, 75].map((w, j) => (
                      <div key={j} className="h-1 rounded-sm bg-gray-100" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                  <span className={`block text-center text-[9px] pb-1 font-medium ${activePage === i + 1 ? 'text-green-600' : 'text-gray-300'}`}>{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {captureModalOpen && pendingFieldRef.current && (
          <SignatureCaptureModal
            fieldType={pendingFieldRef.current.field_type as 'signature' | 'initials'}
            onConfirm={handleCaptureConfirm}
            onCancel={handleCaptureCancel}
          />
        )}
      </>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto fade-in-up">

        {/* ── Header + Step indicator ── */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-5">New Envelope</h1>
          <div className="flex items-center">
            {steps.map((s, i) => {
              const currentIdx = steps.findIndex(x => x.id === step);
              const done = currentIdx > i;
              const active = currentIdx === i;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                      done   ? 'bg-brand-600 text-white shadow-sm' :
                      active ? 'bg-brand-600 text-white shadow-md shadow-brand-200' :
                               'bg-white border-2 border-gray-200 text-gray-400'
                    }`}>
                      {done ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      ) : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1.5 font-semibold ${active ? 'text-brand-600' : done ? 'text-brand-500' : 'text-gray-400'}`}>{s.label}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mb-4 transition-colors duration-300 ${done ? 'bg-brand-500' : 'bg-gray-200'}`}/>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900">Document Details</h2>
            <div>
              <label className="label">Subject <span className="text-red-500">*</span></label>
              <input className="input" type="text" placeholder="e.g. Employment Agreement Q3 2024"
                value={subject} onChange={e => setSubject(e.target.value)}/>
            </div>
            <div>
              <label className="label">Message to Recipients</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Please review and sign this document..."
                value={message} onChange={e => setMessage(e.target.value)}/>
            </div>
            <div>
              <label className="label">PDF Document <span className="text-red-500">*</span></label>
              <input type="file" accept=".pdf,application/pdf" className="hidden" id="pdf-upload"
                onChange={e => setPdfFile(e.target.files?.[0] || null)}/>
              <label htmlFor="pdf-upload" className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                pdfFile ? 'border-brand-400 bg-brand-50/40' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
              }`}>
                {pdfFile ? (
                  <div>
                    <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                    </div>
                    <p className="font-semibold text-gray-900">{pdfFile.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB · Click to change</p>
                  </div>
                ) : (
                  <div>
                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <p className="text-gray-500 font-medium">Drop PDF here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">PDF only · Max 25 MB</p>
                  </div>
                )}
              </label>
            </div>
            <button className="btn-primary w-full justify-center" onClick={handleUpload} disabled={loading || !pdfFile || !subject}>
              {loading ? (
                <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Uploading…</span>
              ) : 'Upload & Continue'}
            </button>
          </div>
        )}

        {/* ── Step 2: Recipients ── */}
        {step === 'recipients' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900">Add Recipients</h2>
            {recipients.map((r, i) => {
              const borderColors = ['border-blue-200 bg-blue-50/30', 'border-purple-200 bg-purple-50/30', 'border-orange-200 bg-orange-50/30', 'border-pink-200 bg-pink-50/30'];
              return (
                <div key={i} className={`rounded-xl p-4 space-y-3 border-2 ${borderColors[i % borderColors.length]}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length]}`}>{i + 1}</span>
                      <span className="text-sm font-semibold text-gray-700">Recipient {i + 1}</span>
                    </div>
                    {recipients.length > 1 && (
                      <button className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
                        onClick={() => setRecipients(rs => rs.filter((_, ri) => ri !== i))}>Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Full Name</label>
                      <input className="input" type="text" placeholder="Jane Doe"
                        value={r.full_name} onChange={e => setRecipients(rs => rs.map((x, ri) => ri === i ? { ...x, full_name: e.target.value } : x))}/>
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input className="input" type="email" placeholder="jane@example.com"
                        value={r.email} onChange={e => setRecipients(rs => rs.map((x, ri) => ri === i ? { ...x, email: e.target.value } : x))}/>
                    </div>
                  </div>
                  <div>
                    <label className="label">Required Identity Level</label>
                    <select className="input" value={r.auth_required}
                      onChange={e => setRecipients(rs => rs.map((x, ri) => ri === i ? { ...x, auth_required: e.target.value as 'SES' | 'AES' } : x))}>
                      <option value="SES">SES — Email verified (standard)</option>
                      <option value="AES">AES — Advanced (phone OTP + ID)</option>
                    </select>
                  </div>
                </div>
              );
            })}
            <button className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-brand-300 hover:bg-brand-50/30 text-sm font-medium text-gray-500 hover:text-brand-600 transition-all duration-200"
              onClick={() => setRecipients(rs => [...rs, { email: '', full_name: '', order_index: rs.length + 1, auth_required: 'SES' }])}>
              + Add Another Recipient
            </button>
            <div className="flex gap-3 pt-1">
              <button className="btn-secondary" onClick={() => setStep('upload')}>Back</button>
              <button className="btn-primary flex-1" onClick={handleSaveRecipients} disabled={loading}>
                {loading ? 'Saving…' : 'Save & Place Fields'}
              </button>
            </div>
          </div>
        )}


        {/* ── Step 4: Review & Send ── */}
        {step === 'review' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-6" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <h2 className="font-semibold text-gray-900">Review & Send</h2>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Subject', value: subject },
                { label: 'Document', value: pdfFile?.name || '—' },
                { label: 'Pages', value: String(pageCount) },
                { label: 'Signature Fields', value: `${fields.length} placed` },
              ].map(row => (
                <div key={row.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{row.label}</p>
                  <p className="text-sm font-medium text-gray-800 truncate">{row.value}</p>
                </div>
              ))}
            </div>

            {/* Recipients */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">Recipients ({recipients.length})</p>
              <div className="space-y-2">
                {recipients.map((r, i) => {
                  const fieldCount = fields.filter(f => f.recipient_index === i).length;
                  return (
                    <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border flex-shrink-0 ${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length]}`}>{i+1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{r.email}</p>
                      </div>
                      <span className="text-xs text-gray-400">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r.auth_required === 'AES' ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                        {r.auth_required}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
              <strong>Ready to send?</strong> All recipients will receive an email with a signing link. You cannot edit the envelope after sending.
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('fields')}>Back</button>
              <button className="btn-primary flex-1" onClick={handleSend} disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Sending…</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                    Send Envelope
                  </span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {captureModalOpen && pendingFieldRef.current && (
        <SignatureCaptureModal
          fieldType={pendingFieldRef.current.field_type as 'signature' | 'initials'}
          onConfirm={handleCaptureConfirm}
          onCancel={handleCaptureCancel}
        />
      )}
    </Layout>
  );
}