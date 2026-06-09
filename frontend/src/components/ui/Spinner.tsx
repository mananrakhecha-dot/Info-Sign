import React from 'react';

export function Spinner({ size = 8 }: { size?: number }) {
  return (
    <div
      className="border-4 border-brand-600 border-t-transparent rounded-full animate-spin"
      style={{ width: size * 4, height: size * 4 }}
      role="status"
      aria-label="Loading"
    />
  );
}