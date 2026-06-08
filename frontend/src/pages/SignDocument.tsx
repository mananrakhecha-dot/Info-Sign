import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { envelopeApi } from '../api/envelopes';
import { SignatureCaptureModal } from '../components/SignatureCaptureModal';
import { Layout } from '../components/Layout';

interface PlacedField {
  id: string;
  pageNumber: number;
  x: number;   // percentage of container width
  y: number;   // percentage of container height
  width: number;  // percentage (default 30)
  height: number; // percentage (default 10)
  fieldType: 'signature' | 'date' | 'text';
  signatureData?: string; // base64 PNG
  value?: string;
}

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['Upload', 'Place Fields & Sign', 'Send'];
  return (
    <div className="flex items-center mb-8">
      {steps.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done = idx < step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : done
                    ? 'bg-brand-200 text-brand-700'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {done ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  idx
                )}
              </div>
              <span
                className={`mt-1 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-brand-700' : done ? 'text-brand-500' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 mt-[-12px] transition-colors ${
                  done ? 'bg-brand-400' : 'bg-gray-200'
                }`}
              />
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
  const [blobUrl, setBlobUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Step 2
  const [fields, setFields] = useState<PlacedField[]>([]);
  const [activeFieldType, setActiveFieldType] = useState<PlacedField['fieldType'] | null>(null);
  const [sigModalFieldId, setSigModalFieldId] = useState<string | null>(null);

  // Step 3
  const [subject, setSubject] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [sending, setSending] = useState(false);

  // ── File handling ──────────────────────────────────────────────────────────
  function handleFile(f: File) {
    if (f.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }
    setFile(f);
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    setBlobUrl(URL.createObjectURL(f));
    setSubject(f.name.replace(/\.pdf$/i, ''));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  // ── Field helpers ──────────────────────────────────────────────────────────
  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  function updateFieldValue(id: string, value: string) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, value } : f));
  }

  function updateFieldSignature(id: string, signatureData: string) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, signatureData } : f));
    setSigModalFieldId(null);
  }

  // Count per type for labels
  function fieldLabel(f: PlacedField) {
    const sameType = fields.filter(ff => ff.fieldType === f.fieldType);
    const idx = sameType.findIndex(ff => ff.id === f.id) + 1;
    const typeName = f.fieldType.charAt(0).toUpperCase() + f.fieldType.slice(1);
    return `${typeName} ${idx}`;
  }

  // ── Next button for step 2 validation ──────────────────────────────────────
  const canProceedStep2 =
    fields.length > 0 &&
    fields.every(f => f.fieldType !== 'signature' || !!f.signatureData);

  // ── Email tag helpers ──────────────────────────────────────────────────────
  function isValidEmail(e: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  }

  function addEmail(raw: string) {
    const val = raw.trim().replace(/,+$/, '');
    if (!val) return;
    if (!isValidEmail(val)) {
      toast.error('Invalid email address');
      return;
    }
    if (emails.includes(val)) {
      toast.error('Email already added');
      setEmailInput('');
      return;
    }
    setEmails(prev => [...prev, val]);
    setEmailInput('');
  }

  function onEmailKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEmail(emailInput);
    } else if (e.key === 'Backspace' && !emailInput && emails.length > 0) {
      setEmails(prev => prev.slice(0, -1));
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSend() {
    if (!file) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('document', file);
      fd.append('subject', subject);
      fd.append(
        'fields',
        JSON.stringify(
          fields.map(f => ({
            pageNumber: f.pageNumber,
            x: f.x,
            y: f.y,
            width: f.width,
            height: f.height,
            fieldType: f.fieldType,
            signatureData: f.signatureData,
            value: f.value,
          })),
        ),
      );
      fd.append('recipientEmails', JSON.stringify(emails));

      const res = await envelopeApi.selfSign(fd);
      toast.success('Document signed and sent!');
      navigate('/envelopes/' + res.data.envelopeId);
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error(
          <span>
            Complete identity verification first.{' '}
            <Link to="/verify-identity" className="underline font-semibold">
              Verify now
            </Link>
          </span>,
        );
      } else {
        toast.error(err.response?.data?.error || 'Failed to sign document');
      }
    } finally {
      setSending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const modalField = sigModalFieldId ? fields.find(f => f.id === sigModalFieldId) : null;

  return (
    <Layout>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Sign Document</h1>
        <StepIndicator step={step} />

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upload your PDF</h2>

            <div
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer ${
                dragging
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-gray-200 hover:border-brand-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onFileChange}
              />

              {file ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-brand-50 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 text-brand-600"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                      />
                    </svg>
                  </div>
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-brand-50 text-brand-700 rounded-full text-sm font-medium border border-brand-100">
                    {file.name}
                  </span>
                  <p className="text-xs text-gray-400">Click to choose a different file</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-6 h-6 text-gray-400"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Drop a PDF here or{' '}
                      <span className="text-brand-600 font-semibold">click to browse</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-1">PDF files only</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                className="btn-primary"
                disabled={!file}
                onClick={() => setStep(2)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Place fields & sign ── */}
        {step === 2 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Place Fields &amp; Sign</h2>
            <p className="text-sm text-gray-500 mb-4">
              Click a field type button, then click on the PDF to place it.
            </p>

            <div className="flex gap-4" style={{ minHeight: 600 }}>
              {/* Left panel */}
              <div className="w-64 flex-shrink-0 flex flex-col gap-4">
                {/* Field type buttons */}
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Add Field
                  </p>

                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      activeFieldType === 'signature'
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400 hover:text-brand-700'
                    }`}
                    onClick={() =>
                      setActiveFieldType(prev => (prev === 'signature' ? null : 'signature'))
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                      />
                    </svg>
                    Signature
                  </button>

                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      activeFieldType === 'date'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:text-blue-700'
                    }`}
                    onClick={() =>
                      setActiveFieldType(prev => (prev === 'date' ? null : 'date'))
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                      />
                    </svg>
                    Date
                  </button>

                  <button
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      activeFieldType === 'text'
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400 hover:text-amber-700'
                    }`}
                    onClick={() =>
                      setActiveFieldType(prev => (prev === 'text' ? null : 'text'))
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                      />
                    </svg>
                    Text
                  </button>
                </div>

                {/* Active mode hint */}
                {activeFieldType && (
                  <p className="text-xs text-brand-700 bg-brand-50 rounded-lg px-2 py-1.5 border border-brand-100">
                    Click anywhere on the PDF to place a {activeFieldType} field.
                  </p>
                )}

                {/* Placed fields list */}
                {fields.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Placed Fields
                    </p>
                    {fields.map(f => (
                      <div
                        key={f.id}
                        className={`rounded-lg border px-2 py-2 flex flex-col gap-1 text-xs ${
                          f.fieldType === 'signature'
                            ? 'border-brand-200 bg-brand-50'
                            : f.fieldType === 'date'
                            ? 'border-blue-200 bg-blue-50'
                            : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold ${
                              f.fieldType === 'signature'
                                ? 'text-brand-700'
                                : f.fieldType === 'date'
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {fieldLabel(f)}
                            {f.fieldType === 'signature' && f.signatureData && ' ✓'}
                          </span>
                          <button
                            className="text-gray-400 hover:text-red-500 transition-colors leading-none"
                            onClick={() => removeField(f.id)}
                            title="Remove field"
                          >
                            &times;
                          </button>
                        </div>

                        {f.fieldType === 'signature' && !f.signatureData && (
                          <button
                            className="text-brand-600 hover:text-brand-800 underline text-left"
                            onClick={() => setSigModalFieldId(f.id)}
                          >
                            Click to sign
                          </button>
                        )}
                        {f.fieldType === 'signature' && f.signatureData && (
                          <button
                            className="text-brand-500 hover:text-brand-700 underline text-left"
                            onClick={() => setSigModalFieldId(f.id)}
                          >
                            Change signature
                          </button>
                        )}
                        {f.fieldType === 'date' && (
                          <input
                            type="date"
                            className="text-xs border border-blue-200 rounded px-1 py-0.5 bg-white text-blue-800 w-full"
                            value={f.value || ''}
                            onChange={e => updateFieldValue(f.id, e.target.value)}
                          />
                        )}
                        {f.fieldType === 'text' && (
                          <input
                            type="text"
                            placeholder="Enter text"
                            className="text-xs border border-amber-200 rounded px-1 py-0.5 bg-white text-amber-800 w-full"
                            value={f.value || ''}
                            onChange={e => updateFieldValue(f.id, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right panel: PDF + overlay */}
              <div
                className="relative flex-1 rounded-xl overflow-hidden border border-gray-200"
                style={{ minHeight: 600 }}
              >
                <iframe
                  src={blobUrl}
                  className="w-full h-full"
                  style={{ minHeight: 600 }}
                  title="PDF preview"
                />

                {/* Transparent click overlay — only active when a field type is selected */}
                <div
                  className="absolute inset-0"
                  style={{
                    cursor: activeFieldType ? 'crosshair' : 'default',
                    backgroundColor: 'transparent',
                    pointerEvents: activeFieldType ? 'all' : 'none',
                  }}
                  onClick={e => {
                    if (!activeFieldType) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    const newField: PlacedField = {
                      id: crypto.randomUUID(),
                      pageNumber: 1,
                      x: Math.max(0, x - 15),
                      y: Math.max(0, y - 5),
                      width: 30,
                      height: 10,
                      fieldType: activeFieldType,
                      value:
                        activeFieldType === 'date'
                          ? new Date().toLocaleDateString()
                          : '',
                    };
                    setFields(prev => [...prev, newField]);
                    setActiveFieldType(null);
                  }}
                />

                {/* Visual overlays for placed fields */}
                {fields.map(f => (
                  <div
                    key={f.id}
                    className={`absolute border-2 rounded flex items-center justify-center text-xs font-medium pointer-events-none ${
                      f.fieldType === 'signature'
                        ? 'border-brand-500 bg-brand-50/70 text-brand-700'
                        : f.fieldType === 'date'
                        ? 'border-blue-500 bg-blue-50/70 text-blue-700'
                        : 'border-amber-500 bg-amber-50/70 text-amber-700'
                    }`}
                    style={{
                      left: `${f.x}%`,
                      top: `${f.y}%`,
                      width: `${f.width}%`,
                      height: `${f.height}%`,
                      pointerEvents: 'none',
                    }}
                  >
                    {f.fieldType === 'signature' && f.signatureData ? (
                      <img
                        src={f.signatureData}
                        className="max-h-full max-w-full object-contain"
                        alt="signature"
                      />
                    ) : f.fieldType === 'signature' ? (
                      'Click to sign'
                    ) : (
                      f.value
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button className="btn-secondary" onClick={() => setStep(1)}>
                &larr; Back
              </button>
              <button
                className="btn-primary"
                disabled={!canProceedStep2}
                onClick={() => setStep(3)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Send ── */}
        {step === 3 && (
          <div className="card max-w-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Send Document</h2>

            <div className="space-y-5">
              {/* Subject */}
              <div>
                <label className="label">Subject</label>
                <input
                  type="text"
                  className="input w-full mt-1"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Document subject"
                />
              </div>

              {/* Recipient emails */}
              <div>
                <label className="label">
                  Recipients{' '}
                  <span className="text-gray-400 font-normal text-xs">(optional — press Enter or comma to add)</span>
                </label>
                <div className="mt-1 min-h-[42px] flex flex-wrap gap-1.5 items-center px-3 py-2 border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 bg-white">
                  {emails.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full text-xs font-medium border border-brand-100"
                    >
                      {email}
                      <button
                        type="button"
                        className="text-brand-400 hover:text-brand-700 leading-none"
                        onClick={() => setEmails(prev => prev.filter(e => e !== email))}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  <input
                    type="email"
                    className="flex-1 min-w-[160px] text-sm outline-none bg-transparent placeholder-gray-400"
                    placeholder={emails.length === 0 ? 'recipient@example.com' : ''}
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    onKeyDown={onEmailKeyDown}
                    onBlur={() => { if (emailInput.trim()) addEmail(emailInput); }}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">Document:</span> {file?.name}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Fields placed:</span>{' '}
                  {fields.length} ({fields.filter(f => f.fieldType === 'signature').length} signature,{' '}
                  {fields.filter(f => f.fieldType === 'date').length} date,{' '}
                  {fields.filter(f => f.fieldType === 'text').length} text)
                </p>
                {emails.length > 0 && (
                  <p>
                    <span className="font-medium text-gray-900">Recipients:</span>{' '}
                    {emails.join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button className="btn-secondary" onClick={() => setStep(2)}>
                &larr; Back
              </button>
              <button
                className="btn-primary"
                disabled={sending || !subject.trim()}
                onClick={handleSend}
              >
                {sending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing &amp; Sending...
                  </span>
                ) : (
                  'Sign & Send'
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Signature capture modal */}
      {modalField && (
        <SignatureCaptureModal
          fieldType="signature"
          onConfirm={base64 => updateFieldSignature(modalField.id, base64)}
          onCancel={() => setSigModalFieldId(null)}
        />
      )}
    </Layout>
  );
}
