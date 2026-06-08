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

interface FieldOnPage {
  id: string;
  field_type: 'signature' | 'initials' | 'date' | 'text';
  recipient_index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  page_number: number;
  preview_data?: string | null;
}

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
  const [activeFieldType, setActiveFieldType] = useState<'signature' | 'initials' | 'date' | 'text'>('signature');
  const [activeRecipient, setActiveRecipient] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const pageRef = useRef<HTMLDivElement>(null);

  // Signature capture modal
  const [captureModalOpen, setCaptureModalOpen] = useState(false);
  const pendingFieldRef = useRef<Omit<FieldOnPage, 'preview_data'> | null>(null);

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

  // Add field
  const addField = useCallback(() => {
    const base: Omit<FieldOnPage, 'preview_data'> = {
      id: `field-${Date.now()}`,
      field_type: activeFieldType,
      recipient_index: activeRecipient,
      x: 10,
      y: 20,
      width: 20,
      height: 6,
      page_number: activePage,
    };
    if (activeFieldType === 'signature' || activeFieldType === 'initials') {
      pendingFieldRef.current = base;
      setCaptureModalOpen(true);
    } else {
      setFields(f => [...f, { ...base, preview_data: null }]);
      // ── FIX 1: Auto-cycle to next recipient after placing a field ──────────
      if (recipients.length > 1) {
        setActiveRecipient(prev => (prev + 1) % recipients.length);
      }
    }
  }, [activeFieldType, activeRecipient, activePage, recipients.length]);

  const handleCaptureConfirm = useCallback((base64: string) => {
    if (!pendingFieldRef.current) return;
    setFields(f => [...f, { ...pendingFieldRef.current!, preview_data: base64 }]);
    pendingFieldRef.current = null;
    setCaptureModalOpen(false);
    // ── FIX 1: Auto-cycle to next recipient after placing signature ──────────
    if (recipients.length > 1) {
      setActiveRecipient(prev => (prev + 1) % recipients.length);
    }
  }, [recipients.length]);

  const handleCaptureCancel = useCallback(() => {
    pendingFieldRef.current = null;
    setCaptureModalOpen(false);
  }, []);

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
        field_type: f.field_type,
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

        {/* ── Step 3: Field placement ── */}
        {step === 'fields' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h2 className="font-semibold text-gray-900 mb-4">Place Signature Fields</h2>

              {/* Recipient coverage */}
              {recipients.length > 1 && (
                <div className="mb-4 p-3 rounded-xl border border-gray-100 bg-gray-50">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">Field Coverage</p>
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((r, i) => {
                      const count = fields.filter(f => f.recipient_index === i).length;
                      const hasFields = count > 0;
                      return (
                        <button key={i} onClick={() => setActiveRecipient(i)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            activeRecipient === i ? `${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length]} ring-2 ring-offset-1 ring-current` :
                            hasFields ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-red-50 text-red-600 border-red-300'
                          }`}>
                          {hasFields ? '✓' : '!'} {r.full_name || `Recipient ${i + 1}`}
                          <span className="opacity-60">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                  {recipientsWithNoFields.length > 0 && (
                    <p className="text-xs text-red-600 mt-2 font-medium">
                      ⚠ {recipientsWithNoFields.map(r => r.name).join(', ')} {recipientsWithNoFields.length === 1 ? 'has' : 'have'} no fields yet
                    </p>
                  )}
                </div>
              )}

              {/* Controls */}
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <label className="label text-[10px] uppercase tracking-wider">Field Type</label>
                  <select className="input text-sm py-1.5" value={activeFieldType} onChange={e => setActiveFieldType(e.target.value as any)}>
                    <option value="signature">Signature</option>
                    <option value="initials">Initials</option>
                    <option value="date">Date</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] uppercase tracking-wider">Recipient</label>
                  <select className={`input text-sm py-1.5 font-medium border-2 ${FIELD_COLORS[activeRecipient % FIELD_COLORS.length].split(' ')[0]}`}
                    value={activeRecipient} onChange={e => setActiveRecipient(Number(e.target.value))}>
                    {recipients.map((r, i) => {
                      const count = fields.filter(f => f.recipient_index === i).length;
                      return <option key={i} value={i}>{r.full_name || `Recipient ${i + 1}`} ({count})</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="label text-[10px] uppercase tracking-wider">Page</label>
                  <select className="input text-sm py-1.5" value={activePage} onChange={e => setActivePage(Number(e.target.value))}>
                    {Array.from({ length: pageCount }, (_, i) => <option key={i + 1} value={i + 1}>Page {i + 1}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className="btn-primary text-sm py-1.5" onClick={addField}>
                    + Add for {recipients[activeRecipient]?.full_name?.split(' ')[0] || `R${activeRecipient + 1}`}
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-400 mb-2">Fields on page {activePage}: {fields.filter(f => f.page_number === activePage).length}</p>

              {/* PDF canvas */}
              <div ref={pageRef} className="relative bg-gray-100 border border-gray-200 rounded-xl overflow-auto"
                style={{ width: '100%', minHeight: '800px' }}>
                {pdfFile ? (
                  <Document file={pdfFile}
                    loading={<div className="flex items-center justify-center" style={{ height: '800px' }}><div className="w-8 h-8 border-[3px] border-brand-200 border-t-brand-600 rounded-full animate-spin"/></div>}
                    error={<div className="flex items-center justify-center text-red-400 text-sm" style={{ height: '800px' }}>Failed to load PDF preview</div>}>
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
                <div className="absolute inset-0">
                  {fields.filter(f => f.page_number === activePage).map(field => (
                    <Draggable key={field.id} bounds="parent"
                      position={{ x: (field.x / 100) * (pageRef.current?.clientWidth || 600), y: (field.y / 100) * (pageRef.current?.clientHeight || 800) }}
                      onStop={(_, data) => {
                        const pW = pageRef.current?.clientWidth || 600;
                        const pH = pageRef.current?.clientHeight || 800;
                        setFields(fs => fs.map(f => f.id === field.id ? { ...f, x: (data.x / pW) * 100, y: (data.y / pH) * 100 } : f));
                      }}>
                      <div className={`absolute cursor-move border-2 rounded-lg px-1 py-0.5 select-none shadow-sm ${FIELD_COLORS[field.recipient_index % FIELD_COLORS.length]}`}
                        style={{ width: `${field.width}%`, height: `${field.height}%` }}>
                        <div className="flex items-center justify-between">
                          <span className="truncate font-semibold" style={{ fontSize: '9px' }}>
                            {recipients[field.recipient_index]?.full_name?.split(' ')[0] || `R${field.recipient_index + 1}`} · {field.field_type}
                          </span>
                          <button className="text-red-400 hover:text-red-600 ml-1 text-xs leading-none"
                            onClick={e => { e.stopPropagation(); setFields(fs => fs.filter(f => f.id !== field.id)); }}>×</button>
                        </div>
                        {field.preview_data ? (
                          <img src={field.preview_data} alt="sig" className="w-full object-contain" style={{ maxHeight: '60%' }}/>
                        ) : field.field_type === 'date' ? (
                          <div className="truncate" style={{ fontSize: '9px' }}>{new Date().toLocaleDateString('en-IN')}</div>
                        ) : (
                          <div className="opacity-60 truncate" style={{ fontSize: '9px' }}>{field.field_type}</div>
                        )}
                      </div>
                    </Draggable>
                  ))}
                </div>
              </div>
            </div>

            {/* Field list */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <p className="text-sm font-semibold text-gray-700 mb-3">All fields <span className="font-normal text-gray-400">({fields.length} total)</span></p>
              {fields.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-2">No fields added yet — add fields using the controls above</p>
              ) : (
                <div className="space-y-1.5">
                  {fields.map(f => (
                    <div key={f.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <span className="text-sm text-gray-600">
                        Page {f.page_number} — <span className="capitalize">{f.field_type}</span> —{' '}
                        <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${RECIPIENT_BADGE_COLORS[f.recipient_index % RECIPIENT_BADGE_COLORS.length]}`}>
                          {recipients[f.recipient_index]?.full_name || `R${f.recipient_index + 1}`}
                        </span>
                      </span>
                      <button className="text-red-400 text-xs hover:text-red-600 font-medium transition-colors"
                        onClick={() => setFields(fs => fs.filter(x => x.id !== f.id))}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('recipients')}>Back</button>
              <button className="btn-primary flex-1" onClick={handleSaveFields}
                disabled={loading || fields.length === 0 || recipientsWithNoFields.length > 0}
                title={recipientsWithNoFields.length > 0 ? `Missing fields for: ${recipientsWithNoFields.map(r => r.name).join(', ')}` : ''}>
                {loading ? 'Saving…' : recipientsWithNoFields.length > 0
                  ? `⚠ Missing fields for ${recipientsWithNoFields.length} recipient${recipientsWithNoFields.length > 1 ? 's' : ''}`
                  : 'Save Fields & Review'}
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