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
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">New Envelope</h1>
          <div className="flex items-center gap-2 mt-4">
            {steps.map((s, i) => (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-2 ${step === s.id ? 'text-brand-700' : steps.findIndex(x => x.id === step) > i ? 'text-green-600' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${step === s.id ? 'bg-brand-600 text-white' : steps.findIndex(x => x.id === step) > i ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {steps.findIndex(x => x.id === step) > i ? '✓' : i + 1}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Document Details</h2>
            <div>
              <label className="label">Subject *</label>
              <input className="input" type="text" placeholder="e.g. Employment Agreement Q3 2024"
                value={subject} onChange={e => setSubject(e.target.value)} />
            </div>
            <div>
              <label className="label">Message to Recipients</label>
              <textarea className="input min-h-[80px] resize-none" placeholder="Please review and sign this document..."
                value={message} onChange={e => setMessage(e.target.value)} />
            </div>
            <div>
              <label className="label">PDF Document *</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-400 transition-colors">
                <input type="file" accept=".pdf,application/pdf" className="hidden" id="pdf-upload"
                  onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                <label htmlFor="pdf-upload" className="cursor-pointer">
                  {pdfFile ? (
                    <div>
                      <p className="text-green-600 font-medium text-lg">📄 {pdfFile.name}</p>
                      <p className="text-gray-400 text-sm">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="text-gray-500">Click to upload PDF (max 25 MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
            <button className="btn-primary w-full" onClick={handleUpload} disabled={loading || !pdfFile || !subject}>
              {loading ? 'Uploading...' : 'Upload & Continue →'}
            </button>
          </div>
        )}

        {/* Step 2: Recipients */}
        {step === 'recipients' && (
          <div className="card space-y-4">
            <h2 className="font-semibold text-gray-900">Add Recipients</h2>
            {recipients.map((r, i) => (
              <div key={i} className={`rounded-lg p-4 space-y-3 border-2 ${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length].includes('blue') ? 'border-blue-200 bg-blue-50/30' : i % 4 === 1 ? 'border-purple-200 bg-purple-50/30' : i % 4 === 2 ? 'border-orange-200 bg-orange-50/30' : 'border-pink-200 bg-pink-50/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length]}`}>{i + 1}</span>
                    <span className="text-sm font-medium text-gray-700">Recipient {i + 1}</span>
                  </div>
                  {recipients.length > 1 && (
                    <button className="text-red-500 text-sm hover:text-red-700"
                      onClick={() => setRecipients(rs => rs.filter((_, ri) => ri !== i))}>Remove</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Full Name</label>
                    <input className="input" type="text" placeholder="Jane Doe"
                      value={r.full_name} onChange={e => setRecipients(rs => rs.map((x, ri) => ri === i ? { ...x, full_name: e.target.value } : x))} />
                  </div>
                  <div>
                    <label className="label">Email</label>
                    <input className="input" type="email" placeholder="jane@example.com"
                      value={r.email} onChange={e => setRecipients(rs => rs.map((x, ri) => ri === i ? { ...x, email: e.target.value } : x))} />
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
            ))}
            <button className="btn-secondary w-full text-sm"
              onClick={() => setRecipients(rs => [...rs, { email: '', full_name: '', order_index: rs.length + 1, auth_required: 'SES' }])}>
              + Add Another Recipient
            </button>
            <div className="flex gap-3 pt-2">
              <button className="btn-secondary" onClick={() => setStep('upload')}>Back</button>
              <button className="btn-primary flex-1" onClick={handleSaveRecipients} disabled={loading}>
                {loading ? 'Saving...' : 'Save & Place Fields →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Field placement */}
        {step === 'fields' && (
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-3">Place Signature Fields</h2>

              {/* ── FIX 1: Recipient coverage tracker ─────────────────────────── */}
              {recipients.length > 1 && (
                <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Field coverage — every recipient needs at least one field</p>
                  <div className="flex flex-wrap gap-2">
                    {recipients.map((r, i) => {
                      const count = fields.filter(f => f.recipient_index === i).length;
                      const hasFields = count > 0;
                      return (
                        <button
                          key={i}
                          onClick={() => setActiveRecipient(i)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            activeRecipient === i
                              ? `${RECIPIENT_BADGE_COLORS[i % RECIPIENT_BADGE_COLORS.length]} ring-2 ring-offset-1 ring-current`
                              : hasFields
                              ? 'bg-green-50 text-green-700 border-green-300'
                              : 'bg-red-50 text-red-600 border-red-300'
                          }`}
                        >
                          {hasFields ? '✓' : '!'} {r.full_name || `Recipient ${i + 1}`}
                          <span className="opacity-70">({count} field{count !== 1 ? 's' : ''})</span>
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

              <div className="flex flex-wrap gap-2 mb-4">
                <div>
                  <label className="label text-xs">Field Type</label>
                  <select className="input text-sm py-1.5" value={activeFieldType} onChange={e => setActiveFieldType(e.target.value as any)}>
                    <option value="signature">Signature</option>
                    <option value="initials">Initials</option>
                    <option value="date">Date</option>
                    <option value="text">Text</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">For Recipient</label>
                  <select
                    className={`input text-sm py-1.5 font-medium border-2 ${FIELD_COLORS[activeRecipient % FIELD_COLORS.length].split(' ')[0]}`}
                    value={activeRecipient}
                    onChange={e => setActiveRecipient(Number(e.target.value))}
                  >
                    {recipients.map((r, i) => {
                      const count = fields.filter(f => f.recipient_index === i).length;
                      return (
                        <option key={i} value={i}>
                          {r.full_name || `Recipient ${i + 1}`} ({count} field{count !== 1 ? 's' : ''})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Page</label>
                  <select className="input text-sm py-1.5" value={activePage} onChange={e => setActivePage(Number(e.target.value))}>
                    {Array.from({ length: pageCount }, (_, i) => <option key={i + 1} value={i + 1}>Page {i + 1}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button className={`btn-primary text-sm py-1.5 flex items-center gap-1`} onClick={addField}>
                    + Add Field for <span className="font-bold">{recipients[activeRecipient]?.full_name?.split(' ')[0] || `R${activeRecipient + 1}`}</span>
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 mb-2">Fields on page {activePage}: {fields.filter(f => f.page_number === activePage).length}</div>

              {/* PDF canvas */}
              <div ref={pageRef} className="relative bg-gray-100 border-2 border-gray-300 rounded-lg overflow-auto"
                style={{ width: '100%', minHeight: '800px' }}>
                {pdfFile ? (
                  <Document
                    file={pdfFile}
                    loading={
                      <div className="flex items-center justify-center" style={{ height: '800px' }}>
                        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center text-red-400 text-sm" style={{ height: '800px' }}>
                        Failed to load PDF preview
                      </div>
                    }
                  >
                    <Page
                      pageNumber={activePage}
                      width={pdfPageWidth}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                    />
                  </Document>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-200">
                    <div className="text-center">
                      <div className="text-6xl mb-2">📄</div>
                      <p className="text-sm">Page {activePage} of {pageCount}</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-0">
                  {fields.filter(f => f.page_number === activePage).map((field) => (
                    <Draggable
                      key={field.id}
                      bounds="parent"
                      position={{ x: (field.x / 100) * (pageRef.current?.clientWidth || 600), y: (field.y / 100) * (pageRef.current?.clientHeight || 800) }}
                      onStop={(_, data) => {
                        const pW = pageRef.current?.clientWidth || 600;
                        const pH = pageRef.current?.clientHeight || 800;
                        setFields(fs => fs.map(f => f.id === field.id
                          ? { ...f, x: (data.x / pW) * 100, y: (data.y / pH) * 100 }
                          : f
                        ));
                      }}
                    >
                      <div
                        className={`absolute cursor-move border-2 rounded px-1 py-0.5 select-none ${FIELD_COLORS[field.recipient_index % FIELD_COLORS.length]}`}
                        style={{ width: `${field.width}%`, height: `${field.height}%` }}
                      >
                        <div className="flex items-center justify-between">
                          {/* ── FIX 1: Show recipient name clearly on every field ── */}
                          <span className="truncate font-semibold" style={{ fontSize: '9px' }}>
                            {recipients[field.recipient_index]?.full_name?.split(' ')[0] || `R${field.recipient_index + 1}`} · {field.field_type}
                          </span>
                          <button className="text-red-400 hover:text-red-600 ml-1 text-xs leading-none"
                            onClick={(e) => { e.stopPropagation(); setFields(fs => fs.filter(f => f.id !== field.id)); }}>×</button>
                        </div>
                        {field.preview_data ? (
                          <img src={field.preview_data} alt="sig" className="w-full object-contain" style={{ maxHeight: '60%' }} />
                        ) : field.field_type === 'date' ? (
                          <div className="truncate" style={{ fontSize: '9px' }}>
                            {new Date().toLocaleDateString('en-IN')}
                          </div>
                        ) : (
                          <div className="opacity-60 truncate" style={{ fontSize: '9px' }}>
                            {field.field_type}
                          </div>
                        )}
                      </div>
                    </Draggable>
                  ))}
                </div>
              </div>
            </div>

            {/* Field list */}
            <div className="card">
              <p className="text-sm font-medium text-gray-700 mb-2">All fields ({fields.length} total):</p>
              {fields.length === 0 ? <p className="text-gray-400 text-sm">No fields added yet</p> : (
                <div className="space-y-1">
                  {fields.map(f => (
                    <div key={f.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-gray-600">
                        Page {f.page_number} — {f.field_type} —{' '}
                        <span className={`font-medium px-1.5 py-0.5 rounded text-xs ${RECIPIENT_BADGE_COLORS[f.recipient_index % RECIPIENT_BADGE_COLORS.length]}`}>
                          {recipients[f.recipient_index]?.full_name || `R${f.recipient_index + 1}`}
                        </span>
                      </span>
                      <button className="text-red-400 text-xs hover:text-red-600" onClick={() => setFields(fs => fs.filter(x => x.id !== f.id))}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('recipients')}>Back</button>
              <button
                className="btn-primary flex-1"
                onClick={handleSaveFields}
                disabled={loading || fields.length === 0 || recipientsWithNoFields.length > 0}
                title={recipientsWithNoFields.length > 0 ? `Missing fields for: ${recipientsWithNoFields.map(r => r.name).join(', ')}` : ''}
              >
                {loading ? 'Saving...' : recipientsWithNoFields.length > 0
                  ? `⚠ Missing fields for ${recipientsWithNoFields.length} recipient${recipientsWithNoFields.length > 1 ? 's' : ''}`
                  : 'Save Fields & Review →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Send */}
        {step === 'review' && (
          <div className="card space-y-6">
            <h2 className="font-semibold text-gray-900">Review & Send</h2>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p><span className="font-medium text-gray-700">Subject:</span> <span className="text-gray-900">{subject}</span></p>
              <p><span className="font-medium text-gray-700">Document:</span> <span className="text-gray-900">{pdfFile?.name}</span></p>
              <p><span className="font-medium text-gray-700">Pages:</span> <span className="text-gray-900">{pageCount}</span></p>
              <p><span className="font-medium text-gray-700">Fields:</span> <span className="text-gray-900">{fields.length} placed</span></p>
            </div>
            <div>
              <p className="font-medium text-gray-700 mb-2">Recipients ({recipients.length}):</p>
              <div className="space-y-2">
                {recipients.map((r, i) => {
                  const fieldCount = fields.filter(f => f.recipient_index === i).length;
                  return (
                    <div key={i} className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-2 text-sm">
                      <span className="font-medium text-blue-800">{r.full_name}</span>
                      <span className="text-blue-600">{r.email}</span>
                      <span className="text-xs text-gray-500">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.auth_required === 'AES' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {r.auth_required}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
              <strong>Ready to send?</strong> All recipients will receive an email with a signing link. You cannot edit the envelope after sending.
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={() => setStep('fields')}>Back</button>
              <button className="btn-primary flex-1" onClick={handleSend} disabled={loading}>
                {loading ? 'Sending...' : '📨 Send Envelope'}
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