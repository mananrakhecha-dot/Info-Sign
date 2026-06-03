import React, { useState } from 'react';

interface AuditEvent {
  id: string;
  event_type: string;
  recipient_email?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: any;
  created_at: string;
}

const eventConfig: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  envelope_created: { icon: '📄', label: 'Envelope Created', color: 'text-gray-700', bg: 'bg-gray-100' },
  envelope_sent: { icon: '📨', label: 'Sent to Recipient', color: 'text-blue-700', bg: 'bg-blue-100' },
  signing_link_opened: { icon: '👁', label: 'Link Opened', color: 'text-purple-700', bg: 'bg-purple-100' },
  edisclosure_accepted: { icon: '✅', label: 'eDisclosure Accepted', color: 'text-green-700', bg: 'bg-green-100' },
  identity_verified: { icon: '🔐', label: 'Identity Verified', color: 'text-green-700', bg: 'bg-green-100' },
  pre_sign_hash: { icon: '🔒', label: 'Document Hash Captured', color: 'text-gray-500', bg: 'bg-gray-100' },
  signed: { icon: '✍️', label: 'Document Signed', color: 'text-green-800', bg: 'bg-green-100' },
  envelope_completed: { icon: '🎉', label: 'Envelope Completed', color: 'text-green-800', bg: 'bg-green-100' },
  envelope_declined: { icon: '❌', label: 'Signing Declined', color: 'text-red-700', bg: 'bg-red-100' },
  envelope_voided: { icon: '🚫', label: 'Envelope Voided', color: 'text-gray-600', bg: 'bg-gray-100' },
  download: { icon: '⬇️', label: 'Document Downloaded', color: 'text-blue-600', bg: 'bg-blue-100' },
  certificate_generated: { icon: '📜', label: 'Certificate Generated', color: 'text-green-700', bg: 'bg-green-100' },
  otp_sent: { icon: '📱', label: 'OTP Sent', color: 'text-blue-600', bg: 'bg-blue-100' },
  otp_verified: { icon: '📱', label: 'OTP Verified', color: 'text-green-700', bg: 'bg-green-100' },
  id_upload: { icon: '🪪', label: 'ID Uploaded', color: 'text-blue-700', bg: 'bg-blue-100' },
  id_approved: { icon: '✅', label: 'ID Approved', color: 'text-green-700', bg: 'bg-green-100' },
  id_rejected: { icon: '❌', label: 'ID Rejected', color: 'text-red-700', bg: 'bg-red-100' },
};

// ── User-agent helpers ──────────────────────────────────────────────────────
function parseBrowser(ua: string): string {
  if (!ua) return '';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari')) return 'Safari';
  return 'Browser';
}

function parseOS(ua: string): string {
  if (!ua) return '';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return '';
}

// ── Metadata extras ─────────────────────────────────────────────────────────
function MetaExtras({ event }: { event: AuditEvent }) {
  const m = event.metadata || {};
  const [expanded, setExpanded] = useState(false);

  const rows: { label: string; value: string; mono?: boolean; truncate?: boolean }[] = [];

  if (event.event_type === 'identity_verified' && m.identityLevel) {
    rows.push({ label: 'Level', value: m.identityLevel });
  }
  if (event.event_type === 'signed' && m.signerName) {
    rows.push({ label: 'Signer', value: m.signerName });
  }
  if ((event.event_type === 'signed') && m.docHashAfter) {
    rows.push({ label: 'SHA-256 after', value: m.docHashAfter, mono: true, truncate: true });
  }
  if (event.event_type === 'pre_sign_hash' && m.hash) {
    rows.push({ label: 'SHA-256', value: m.hash, mono: true, truncate: true });
  }
  if ((event.event_type === 'envelope_voided' || event.event_type === 'envelope_declined') && m.reason) {
    rows.push({ label: 'Reason', value: m.reason });
  }
  if (event.event_type === 'envelope_created' && m.subject) {
    rows.push({ label: 'Subject', value: m.subject });
  }
  if (event.event_type === 'envelope_sent' && m.recipientName) {
    rows.push({ label: 'Recipient', value: m.recipientName });
  }
  if (event.event_type === 'id_rejected' && m.reason) {
    rows.push({ label: 'Reason', value: m.reason });
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {rows.map(({ label, value, mono, truncate }) => (
        <div key={label} className="flex items-start gap-1.5 text-xs">
          <span className="text-gray-400 shrink-0">{label}:</span>
          <span
            className={`${mono ? 'font-mono text-gray-500' : 'text-gray-600'} ${truncate && !expanded ? 'truncate max-w-[180px]' : 'break-all'}`}
            title={value}
          >
            {truncate && !expanded ? value.slice(0, 20) + '…' : value}
          </span>
          {truncate && (
            <button
              className="shrink-0 text-brand-600 hover:underline text-xs leading-none"
              onClick={() => setExpanded(e => !e)}
            >
              {expanded ? 'less' : 'more'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export function Timeline({ events }: { events: AuditEvent[] }) {
  if (!events?.length) {
    return <p className="text-gray-400 text-sm text-center py-8">No events yet</p>;
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {events.map((event, idx) => {
          const cfg = eventConfig[event.event_type] ?? {
            icon: '•', label: event.event_type, color: 'text-gray-500', bg: 'bg-gray-100',
          };
          const browser = parseBrowser(event.user_agent || '');
          const os = parseOS(event.user_agent || '');
          const deviceStr = [browser, os].filter(Boolean).join(' on ');

          return (
            <li key={event.id}>
              <div className="relative pb-6">
                {idx !== events.length - 1 && (
                  <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" />
                )}
                <div className="relative flex gap-3">
                  {/* Icon bubble */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${cfg.bg}`}>
                    {cfg.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-tight ${cfg.color}`}>{cfg.label}</p>
                      <time className="shrink-0 text-xs text-gray-400 mt-0.5">
                        {new Date(event.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </time>
                    </div>

                    {/* Recipient */}
                    {event.recipient_email && (
                      <p className="text-xs text-gray-500 mt-0.5">{event.recipient_email}</p>
                    )}

                    {/* IP + device */}
                    {(event.ip_address || deviceStr) && (
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">
                        {[event.ip_address, deviceStr].filter(Boolean).join('  ·  ')}
                      </p>
                    )}

                    {/* Metadata extras */}
                    <MetaExtras event={event} />
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}