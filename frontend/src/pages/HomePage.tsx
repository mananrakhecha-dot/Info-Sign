import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Layout } from '../components/Layout';

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      {/* Hero section */}
      <div
        className="rounded-2xl overflow-hidden mb-8"
        style={{
          background: 'linear-gradient(to bottom right, #16a34a, #10b981, #14b8a6)',
          position: 'relative',
        }}
      >
        {/* Dot pattern overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative py-16 px-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.full_name || 'there'}
          </h1>
          <p className="text-lg text-white" style={{ opacity: 0.9 }}>
            What would you like to do today?
          </p>
        </div>
      </div>

      {/* Cards section */}
      <div className="bg-gray-50 rounded-2xl py-12 px-8">
        <div
          className="grid gap-6 max-w-3xl mx-auto"
          style={{ gridTemplateColumns: '1fr 1fr' }}
        >
          {/* Card 1 — Sign Document */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-start gap-4">
            {/* Icon circle */}
            <div className="bg-brand-50 rounded-xl p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-7 h-7 text-brand-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Sign Document</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Sign a PDF with your digital certificate. Your signature is cryptographically
                sealed and verifiable in Adobe Acrobat.
              </p>
            </div>

            {user?.identity_level === 'NONE' && (
              <div className="w-full rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 flex-shrink-0 text-yellow-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>
                  Identity verification required.{' '}
                  <Link to="/verify-identity" className="underline font-semibold hover:text-yellow-900">
                    Verify now
                  </Link>
                </span>
              </div>
            )}

            <button
              className="btn-primary mt-auto"
              disabled={user?.identity_level === 'NONE'}
              style={user?.identity_level === 'NONE' ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              onClick={() => navigate('/sign-document')}
            >
              Start Signing &rarr;
            </button>
          </div>

          {/* Card 2 — Get a Signature */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 flex flex-col items-start gap-4">
            {/* Icon circle */}
            <div className="bg-blue-50 rounded-xl p-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-7 h-7 text-blue-600"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Get a Signature</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Send a document to others to collect their digital signatures. Track progress
                in real time.
              </p>
            </div>

            <button
              className="mt-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#2563eb' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
              onClick={() => navigate('/envelopes/new')}
            >
              Send for Signature &rarr;
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
