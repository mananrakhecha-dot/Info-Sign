import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const mainNav = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    matchPaths: ['/dashboard'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/envelopes/new',
    label: 'New Envelope',
    matchPaths: ['/envelopes/new'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    path: '/envelopes',
    label: 'All Envelopes',
    matchPaths: ['/envelopes'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M3 12h18M3 17h18" />
      </svg>
    ),
  },
];

const accountNav = [
  {
    path: '/verify-identity',
    label: 'Verify Identity',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

const adminNav = [
  {
    path: '/admin/id-review',
    label: 'ID Review',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0" />
      </svg>
    ),
  },
];

function NavItem({ path, label, icon, currentPath, matchPaths }: {
  path: string; label: string; icon: React.ReactNode; currentPath: string;
  matchPaths?: string[];
}) {
  const isActive = matchPaths
    ? matchPaths.some(p => currentPath === p)
    : currentPath === path;
  return (
    <Link
      to={path}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-brand-50 text-brand-700'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className={isActive ? 'text-brand-600' : 'text-gray-400'}>{icon}</span>
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Get initials for avatar
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-base">DocuSign</span>
        </Link>

        {/* Right — profile avatar */}
        <div className="flex items-center gap-2">
          {/* Identity level badge */}
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200">
            {user?.identity_level}
          </span>

          {/* Profile avatar — links to /profile */}
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold hover:bg-brand-700 transition-colors"
            title="View profile"
          >
            {initials}
          </Link>
        </div>
      </header>

      {/* ── Body: sidebar + main ── */}
      <div className="flex flex-1 pt-14">

        {/* ── Sidebar ── */}
        <aside className="fixed top-14 left-0 bottom-0 w-52 bg-white border-r border-gray-200 flex flex-col z-30">

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

            {/* Main section */}
            <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Main
            </p>
            {mainNav.map(item => (
              <NavItem
                key={item.path + item.label}
                path={item.path}
                label={item.label}
                icon={item.icon}
                currentPath={location.pathname}
                matchPaths={(item as any).matchPaths}
              />
            ))}

            {/* Account section */}
            <p className="px-3 mt-5 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Account
            </p>
            {accountNav.map(item => (
              <NavItem
                key={item.path}
                path={item.path}
                label={item.label}
                icon={item.icon}
                currentPath={location.pathname}
              />
            ))}

            {/* Admin section */}
            {user?.role === 'admin' && (
              <>
                <p className="px-3 mt-5 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Admin
                </p>
                {adminNav.map(item => (
                  <NavItem
                    key={item.path}
                    path={item.path}
                    label={item.label}
                    icon={item.icon}
                    currentPath={location.pathname}
                  />
                ))}
              </>
            )}
          </nav>

          {/* Bottom — user info + sign out */}
          <div className="px-3 py-4 border-t border-gray-200 space-y-1">
            <div className="px-3 py-2">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 ml-52 min-h-full">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}