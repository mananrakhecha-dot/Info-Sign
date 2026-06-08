import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const mainNav = [
  {
    path: '/home',
    label: 'Home',
    matchPaths: ['/home'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width:18,height:18}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    path: '/sign-document',
    label: 'Sign Document',
    matchPaths: ['/sign-document'],
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" style={{width:18,height:18}}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    matchPaths: ['/dashboard'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    path: '/envelopes/new',
    label: 'New Envelope',
    matchPaths: ['/envelopes/new'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    path: '/envelopes',
    label: 'All Envelopes',
    matchPaths: ['/envelopes'],
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    path: '/profile',
    label: 'Profile',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
    ? matchPaths.some(p => currentPath === p || currentPath.startsWith(p + '/'))
    : currentPath === path;
  return (
    <Link
      to={path}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
        isActive
          ? 'bg-brand-50 text-brand-700 font-semibold'
          : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className={`flex-shrink-0 ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>{icon}</span>
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

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sm:px-6"
        style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center shadow-sm group-hover:bg-brand-700 transition-colors">
            <svg className="w-4.5 h-4.5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="font-bold text-gray-900 text-[15px] tracking-tight">InfoSign</span>
        </Link>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-100">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            {user?.identity_level}
          </span>
          <Link
            to="/profile"
            className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold hover:bg-brand-700 transition-colors shadow-sm"
            title="View profile"
          >
            {initials}
          </Link>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 pt-14">

        {/* ── Sidebar ── */}
        <aside className="fixed top-14 left-0 bottom-0 w-52 bg-white border-r border-gray-100 flex flex-col z-30"
          style={{ boxShadow: '1px 0 0 #f3f4f6' }}>

          <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">

            <p className="px-3 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
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

            <p className="px-3 pt-5 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
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

            {user?.role === 'admin' && (
              <>
                <p className="px-3 pt-5 mb-2 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
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

          {/* Bottom user card */}
          <div className="px-3 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg mb-1">
              <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{user?.full_name}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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
