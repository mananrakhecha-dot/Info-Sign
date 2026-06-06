import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, FileText } from 'lucide-react';

// ── Animated dot-map background ─────────────────────────────────────────────
function DotMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      canvas.width = width;
      canvas.height = height;
      setDims({ w: width, h: height });
    });
    obs.observe(canvas.parentElement as Element);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!dims.w || !dims.h) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dims;
    const gap = 14;

    // Generate world-map-shaped dots
    const dots: { x: number; y: number; o: number }[] = [];
    for (let x = 0; x < w; x += gap) {
      for (let y = 0; y < h; y += gap) {
        const xr = x / w;
        const yr = y / h;
        const land =
          (xr > 0.05 && xr < 0.25 && yr > 0.1 && yr < 0.42) ||
          (xr > 0.14 && xr < 0.26 && yr > 0.42 && yr < 0.78) ||
          (xr > 0.29 && xr < 0.46 && yr > 0.13 && yr < 0.37) ||
          (xr > 0.34 && xr < 0.51 && yr > 0.35 && yr < 0.68) ||
          (xr > 0.44 && xr < 0.72 && yr > 0.08 && yr < 0.52) ||
          (xr > 0.63 && xr < 0.82 && yr > 0.58 && yr < 0.82);
        if (land && Math.random() > 0.28) {
          dots.push({ x, y, o: Math.random() * 0.45 + 0.15 });
        }
      }
    }

    // Animated routes
    const routes = [
      { sx: w * 0.12, sy: h * 0.22, ex: w * 0.38, ey: h * 0.18, delay: 0 },
      { sx: w * 0.38, sy: h * 0.18, ex: w * 0.58, ey: h * 0.25, delay: 2 },
      { sx: w * 0.08, sy: h * 0.15, ex: w * 0.20, ey: h * 0.55, delay: 1 },
      { sx: w * 0.62, sy: h * 0.15, ex: w * 0.45, ey: h * 0.38, delay: 1.5 },
    ];

    let start = Date.now();
    let raf: number;

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      dots.forEach(d => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99,102,241,${d.o})`;
        ctx.fill();
      });

      const t = (Date.now() - start) / 1000;
      if (t > 12) start = Date.now();

      routes.forEach(r => {
        const el = t - r.delay;
        if (el <= 0) return;
        const p = Math.min(el / 3.5, 1);
        const cx = r.sx + (r.ex - r.sx) * p;
        const cy = r.sy + (r.ey - r.sy) * p;

        ctx.beginPath();
        ctx.moveTo(r.sx, r.sy);
        ctx.lineTo(cx, cy);
        ctx.strokeStyle = 'rgba(99,102,241,0.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(r.sx, r.sy, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99,102,241,0.8)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#6366f1';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(99,102,241,0.25)';
        ctx.fill();

        if (p === 1) {
          ctx.beginPath();
          ctx.arc(r.ex, r.ey, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#6366f1';
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [dims]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

// ── Login page ───────────────────────────────────────────────────────────────
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-4xl overflow-hidden rounded-2xl flex bg-white shadow-2xl shadow-indigo-100/60"
      >
        {/* ── Left panel — animated map ── */}
        <div className="hidden md:block w-1/2 relative overflow-hidden border-r border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-100">
            <DotMap />
          </div>
          {/* Overlay content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full p-10 text-center">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-200 mb-6"
            >
              <FileText className="w-7 h-7 text-white" />
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="text-3xl font-bold text-brand-700 mb-3"
            >
              DocuSign
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="text-sm text-gray-500 max-w-xs leading-relaxed"
            >
              Sign in to access your digital signing dashboard and manage your documents securely.
            </motion.p>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="flex gap-6 mt-10"
            >
              {[
                { label: 'Documents signed', value: '2M+' },
                { label: 'Businesses', value: '10K+' },
              ].map(stat => (
                <div key={stat.label} className="bg-white/70 backdrop-blur-sm rounded-xl px-5 py-3 border border-white/80">
                  <p className="text-xl font-bold text-brand-700">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ── Right panel — login form ── */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {/* Mobile logo */}
            <div className="flex items-center gap-2 mb-8 md:hidden">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900">DocuSign</span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
            <p className="text-gray-500 text-sm mb-8">Sign in to your account to continue</p>

            {/* Email verified banner */}
            {searchParams.get('verified') === '1' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2"
              >
                <span>✅</span> Email verified! You can now sign in.
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email <span className="text-brand-500">*</span>
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Password <span className="text-brand-500">*</span>
                  </label>
                  <Link
                    to="/forgot-password"
                    className="text-xs text-brand-600 hover:text-brand-700 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Your password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword
                      ? <EyeOff className="w-4 h-4" />
                      : <Eye className="w-4 h-4" />
                    }
                  </button>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="btn-primary w-full py-2.5 mt-2 relative overflow-hidden group"
              >
                <span className="flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </span>
              </motion.button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-100" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-white text-xs text-gray-400">Don't have an account?</span>
              </div>
            </div>

            <Link to="/register">
              <motion.button
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                Create a free account
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}