import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuditEvent {
    id: string;
    event_type: string;
    actor_name?: string;
    actor_email?: string;
    /** Legacy field name returned by the existing /history API */
    recipient_email?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export interface AuditTimelineProps {
    events: AuditEvent[];
    loading: boolean;
}

// ── Event config ──────────────────────────────────────────────────────────────

interface EventConfig {
    title: (e: AuditEvent) => string;
    color: string;
    icon: string;
}

function titleCase(str: string): string {
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const CONFIGS: Record<string, EventConfig> = {
    // Canonical event types (spec)
    envelope_created: { title: () => 'Envelope Created', color: '#6b7280', icon: '📄' },
    envelope_sent: { title: () => 'Sent to Recipient', color: '#3b82f6', icon: '✉️' },
    document_viewed: { title: e => e.actor_name ? `Opened by ${e.actor_name}` : 'Document Viewed', color: '#8b5cf6', icon: '👁' },
    signing_started: { title: e => e.actor_name ? `Signing started by ${e.actor_name}` : 'Signing Started', color: '#f97316', icon: '✏️' },
    envelope_signed: { title: e => e.actor_name ? `Signed by ${e.actor_name}` : 'Document Signed', color: '#22c55e', icon: '✅' },
    envelope_completed: { title: () => 'All parties signed', color: '#22c55e', icon: '🎉' },
    certificate_generated: { title: () => 'Certificate generated', color: '#14b8a6', icon: '📜' },
    envelope_voided: { title: () => 'Envelope voided', color: '#ef4444', icon: '✖' },
    envelope_declined: { title: e => e.actor_name ? `Declined by ${e.actor_name}` : 'Signing Declined', color: '#ef4444', icon: '✖' },
    recipient_bounced: { title: () => 'Email bounced', color: '#ef4444', icon: '⚠️' },
    // Legacy event types from the existing backend
    signed: { title: e => { const who = e.actor_name ?? e.recipient_email; return who ? `Signed by ${who}` : 'Document Signed'; }, color: '#22c55e', icon: '✅' },
    signing_link_opened: { title: e => e.actor_name ? `Opened by ${e.actor_name}` : 'Link Opened', color: '#8b5cf6', icon: '👁' },
    edisclosure_accepted: { title: () => 'eDisclosure Accepted', color: '#22c55e', icon: '✅' },
    identity_verified: { title: () => 'Identity Verified', color: '#22c55e', icon: '🔐' },
    pre_sign_hash: { title: () => 'Document Hash Captured', color: '#6b7280', icon: '🔒' },
    download: { title: () => 'Document Downloaded', color: '#3b82f6', icon: '⬇️' },
    otp_sent: { title: () => 'OTP Sent', color: '#3b82f6', icon: '📱' },
    otp_verified: { title: () => 'OTP Verified', color: '#22c55e', icon: '📱' },
    id_upload: { title: () => 'ID Uploaded', color: '#3b82f6', icon: '🪪' },
    id_approved: { title: () => 'ID Approved', color: '#22c55e', icon: '✅' },
    id_rejected: { title: () => 'ID Rejected', color: '#ef4444', icon: '❌' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const h = d.getHours();
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    return `${d.getDate()} ${months[d.getMonth()]} · ${h12}:${String(d.getMinutes()).padStart(2, '0')} ${ampm}`;
}

interface SubtitleResult {
    /** Full text including IP — shown on ≥ sm screens */
    full: string;
    /** Compact text without IP — shown on < sm screens */
    compact: string;
    hasIp: boolean;
}

function buildSubtitle(event: AuditEvent): SubtitleResult {
    const email = event.actor_email || event.recipient_email;
    const location = event.metadata?.location as string | undefined;
    const ip = event.ip_address;

    const baseParts = [email, location].filter(Boolean) as string[];
    const hasIp = !!ip;

    // Nothing at all → fall back to actor_name
    if (baseParts.length === 0 && !hasIp) {
        const name = event.actor_name ?? '';
        return { full: name, compact: name, hasIp: false };
    }

    // Build full parts: insert IP after email (or at front if no email)
    const fullParts = [...baseParts];
    if (hasIp) {
        fullParts.splice(email ? 1 : 0, 0, `IP: ${ip}`);
    }

    // Compact: base parts without IP; if empty, fall back to actor_name
    const compact = baseParts.length > 0 ? baseParts.join(' · ') : (event.actor_name ?? '');

    return { full: fullParts.join(' · '), compact, hasIp };
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow({ isLast }: { isLast: boolean }) {
    return (
        <div className="flex gap-3">
            <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-gray-200 animate-pulse shrink-0 mt-0.5" />
                {!isLast && (
                    <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: '2rem' }} />
                )}
            </div>
            <div className={`flex-1 ${!isLast ? 'pb-5' : ''}`}>
                <div className="flex items-start justify-between gap-4 pt-0.5">
                    <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-gray-200 animate-pulse rounded w-2/5" />
                        <div className="h-3 bg-gray-100 animate-pulse rounded w-3/5" />
                    </div>
                    <div className="h-3 bg-gray-200 animate-pulse rounded w-20 shrink-0" />
                </div>
            </div>
        </div>
    );
}

// ── Single timeline row ───────────────────────────────────────────────────────

function TimelineRow({ event, isLast }: { event: AuditEvent; isLast: boolean }) {
    const cfg: EventConfig = CONFIGS[event.event_type] ?? {
        title: () => titleCase(event.event_type),
        color: '#9ca3af',
        icon: '📋',
    };

    const title = cfg.title(event);
    const { full, compact, hasIp } = buildSubtitle(event);
    const timestamp = formatTimestamp(event.created_at);

    return (
        <div className="flex gap-3">
            {/* Left: colored circle + connector line */}
            <div className="flex flex-col items-center">
                <div
                    className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: cfg.color }}
                >
                    <span style={{ fontSize: '7px', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                        {cfg.icon}
                    </span>
                </div>
                {!isLast && (
                    <div
                        className="w-px flex-1 mt-1"
                        style={{ backgroundColor: '#e5e7eb', minHeight: '1.5rem' }}
                    />
                )}
            </div>

            {/* Content */}
            <div className={`flex-1 min-w-0 ${!isLast ? 'pb-5' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        {/* Event title */}
                        <p className="text-sm font-semibold text-gray-800 leading-snug">{title}</p>

                        {/* Subtitle: full (with IP) on ≥ sm — only if subtitle exists */}
                        {full && (
                            <p className={`text-xs text-gray-400 mt-0.5 truncate${hasIp ? ' hidden sm:block' : ''}`}>
                                {full}
                            </p>
                        )}

                        {/* Subtitle: compact (no IP) on < sm — only when IP causes a difference */}
                        {hasIp && compact && (
                            <p className="sm:hidden text-xs text-gray-400 mt-0.5 truncate">{compact}</p>
                        )}
                    </div>

                    {/* Timestamp */}
                    <time className="text-xs text-gray-400 shrink-0 text-right whitespace-nowrap mt-0.5">
                        {timestamp}
                    </time>
                </div>
            </div>
        </div>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function AuditTimeline({ events, loading }: AuditTimelineProps) {
    return (
        <div
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 overflow-y-auto"
            style={{ maxHeight: '70vh' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-900">Audit Trail</h2>
                {!loading && (
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {events.length} event{events.length !== 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Loading skeleton */}
            {loading && (
                <div>
                    <SkeletonRow isLast={false} />
                    <SkeletonRow isLast={false} />
                    <SkeletonRow isLast={true} />
                </div>
            )}

            {/* Empty state */}
            {!loading && events.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-8">No events recorded yet</p>
            )}

            {/* Timeline */}
            {!loading && events.length > 0 && (
                <div>
                    {events.map((event, idx) => (
                        <TimelineRow
                            key={event.id}
                            event={event}
                            isLast={idx === events.length - 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}