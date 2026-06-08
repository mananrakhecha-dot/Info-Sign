import React from 'react';

const statusConfig: Record<string, { label: string; dot: string; className: string }> = {
  DRAFT:     { label: 'Draft',     dot: 'bg-gray-400',   className: 'bg-gray-50 text-gray-600 border-gray-200' },
  SENT:      { label: 'Sent',      dot: 'bg-blue-500',   className: 'bg-blue-50 text-blue-700 border-blue-200' },
  DELIVERED: { label: 'Delivered', dot: 'bg-violet-500', className: 'bg-violet-50 text-violet-700 border-violet-200' },
  COMPLETED: { label: 'Completed', dot: 'bg-brand-500',  className: 'bg-brand-50 text-brand-700 border-brand-200' },
  DECLINED:  { label: 'Declined',  dot: 'bg-red-500',    className: 'bg-red-50 text-red-700 border-red-200' },
  VOIDED:    { label: 'Voided',    dot: 'bg-gray-400',   className: 'bg-gray-50 text-gray-500 border-gray-200' },
  TAMPERED:  { label: 'Tampered',  dot: 'bg-red-600',    className: 'bg-red-100 text-red-800 border-red-300 font-semibold' },
  PENDING:   { label: 'Pending',   dot: 'bg-amber-500',  className: 'bg-amber-50 text-amber-700 border-amber-200' },
  SIGNED:    { label: 'Signed',    dot: 'bg-brand-500',  className: 'bg-brand-50 text-brand-700 border-brand-200' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, dot: 'bg-gray-400', className: 'bg-gray-50 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export function IdentityBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; icon: string; className: string }> = {
    NONE: { label: 'Unverified', icon: '○', className: 'bg-gray-50 text-gray-500 border-gray-200' },
    SES:  { label: 'SES',        icon: '✓', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    AES:  { label: 'AES',        icon: '✓', className: 'bg-brand-50 text-brand-700 border-brand-200' },
  };
  const c = config[level] || config.NONE;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.className}`}>
      <span className="text-[10px]">{c.icon}</span>
      {c.label}
    </span>
  );
}
