import React, { useEffect, useRef, useState } from "react"
import { motion, useScroll, useTransform } from "framer-motion"
import { Link } from "react-router-dom"
import {
  FileText, Send, Shield, Activity, Menu, X,
  CheckCircle, Lock, Zap, Users, ArrowRight,
  Star, ChevronRight, Check
} from "lucide-react"
import { Button } from "../components/ui/button"
import { Card, CardContent } from "../components/ui/card"
import { cn } from "../lib/utils"
import confetti from "canvas-confetti"

// ── Navbar ─────────────────────────────────────────────────────────────────
// Single row: logo left | floating pill center | CTAs right
const NAV_ITEMS = [
  { name: "Features", href: "#features", icon: Zap    },
  { name: "Security", href: "#security", icon: Shield },
  { name: "Pricing",  href: "#pricing",  icon: Star   },
  { name: "About",    href: "#about",    icon: Users  },
]

function Navbar() {
  const [activeTab, setActiveTab] = useState("Features")
  const [scrolled, setScrolled]   = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16",
      scrolled
        ? "bg-white/80 backdrop-blur-lg border-b border-gray-200/50 shadow-sm"
        : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-4">

        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">SignFlow</span>
        </div>

        {/* Floating pill — center, hidden on mobile */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="flex items-center gap-1 py-1 px-1 rounded-full bg-white/80 backdrop-blur-md border border-gray-200/70 shadow-sm">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.name
              return (
                <a
                  key={item.name}
                  href={item.href}
                  onClick={() => setActiveTab(item.name)}
                  className={cn(
                    "relative cursor-pointer text-sm font-semibold px-5 py-1.5 rounded-full transition-colors select-none",
                    isActive ? "text-brand-600" : "text-gray-500 hover:text-gray-900"
                  )}
                >
                  {item.name}

                  {isActive && (
                    <motion.div
                      layoutId="navbar-lamp"
                      className="absolute inset-0 w-full bg-brand-50 rounded-full -z-10"
                      initial={false}
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    >
                      {/* Lamp glow above active item */}
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-brand-500 rounded-t-full">
                        <div className="absolute w-12 h-6 bg-brand-400/30 rounded-full blur-md -top-2 -left-2" />
                        <div className="absolute w-8 h-5 bg-brand-400/20 rounded-full blur-md -top-1" />
                        <div className="absolute w-4 h-4 bg-brand-400/15 rounded-full blur-sm top-0 left-2" />
                      </div>
                    </motion.div>
                  )}
                </a>
              )
            })}
          </div>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link to="/register">
            <Button size="sm" className="hidden sm:inline-flex">Get Started</Button>
          </Link>
        </div>

      </div>

      {/* Mobile pill — floats at bottom of screen */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <div className="flex items-center gap-1 py-1 px-1 rounded-full bg-white/90 backdrop-blur-md border border-gray-200/80 shadow-lg">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const isActive = activeTab === item.name
            return (
              <a
                key={item.name}
                href={item.href}
                onClick={() => setActiveTab(item.name)}
                className={cn(
                  "relative cursor-pointer px-4 py-2 rounded-full transition-colors select-none",
                  isActive ? "text-brand-600" : "text-gray-500"
                )}
              >
                <Icon size={18} strokeWidth={2.5} />
                {isActive && (
                  <motion.div
                    layoutId="navbar-lamp-mobile"
                    className="absolute inset-0 bg-brand-50 rounded-full -z-10"
                    initial={false}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}


// ── Animated Document SVG ───────────────────────────────────────────────────
function AnimatedDocument() {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <svg viewBox="0 0 340 440" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <defs>
          <style>{`
            @keyframes floatUp { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
            @keyframes floatBack { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
            @keyframes fadeSlide { 0%{opacity:0;transform:translateX(-8px)} 100%{opacity:1;transform:translateX(0)} }
            @keyframes checkPop { 0%{transform:scale(0)} 60%{transform:scale(1.25)} 100%{transform:scale(1)} }
            @keyframes drawSig { 0%{stroke-dashoffset:140} 100%{stroke-dashoffset:0} }
            @keyframes badgePop { 0%{opacity:0;transform:scale(0) translateY(10px)} 60%{transform:scale(1.1) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
            @keyframes pillSlide { 0%{opacity:0;transform:translateX(-10px)} 100%{opacity:1;transform:translateX(0)} }
            @keyframes pillSlideR { 0%{opacity:0;transform:translateX(10px)} 100%{opacity:1;transform:translateX(0)} }
            @keyframes notifSlide { 0%{opacity:0;transform:translateY(-8px)} 100%{opacity:1;transform:translateY(0)} }
            @keyframes pulse2 { 0%,100%{opacity:1;r:4} 50%{opacity:0.4;r:6} }
            .doc-back { animation: floatBack 5s ease-in-out infinite; transform-origin: 170px 220px; }
            .doc-main { animation: floatUp 5s ease-in-out infinite; transform-origin: 170px 210px; }
            .l1 { animation: fadeSlide 0.45s ease forwards 0.4s; opacity:0; }
            .l2 { animation: fadeSlide 0.45s ease forwards 0.7s; opacity:0; }
            .l3 { animation: fadeSlide 0.45s ease forwards 1.0s; opacity:0; }
            .l4 { animation: fadeSlide 0.45s ease forwards 1.3s; opacity:0; }
            .l5 { animation: fadeSlide 0.45s ease forwards 1.6s; opacity:0; }
            .sig-path { stroke-dasharray:140; stroke-dashoffset:140; animation: drawSig 1.1s ease forwards 2.3s; }
            .chk { animation: checkPop 0.4s cubic-bezier(.17,.67,.35,1.4) forwards 1.9s; transform-origin:78px 270px; transform:scale(0); }
            .badge-done { animation: badgePop 0.5s cubic-bezier(.17,.67,.35,1.4) forwards 3s; opacity:0; transform-origin:170px 370px; }
            .pill-l { animation: pillSlide 0.4s ease forwards 3.4s; opacity:0; }
            .pill-r { animation: pillSlideR 0.4s ease forwards 3.7s; opacity:0; }
            .notif { animation: notifSlide 0.4s ease forwards 2.7s; opacity:0; }
            .dot-live { animation: pulse2 1.8s ease-in-out infinite 3.5s; }
            .shield { animation: checkPop 0.4s cubic-bezier(.17,.67,.35,1.4) forwards 0.1s; transform-origin:42px 42px; transform:scale(0); }
          `}</style>
        </defs>

        {/* Back shadow doc */}
        <g className="doc-back">
          <rect x="67" y="30" width="210" height="272" rx="10" fill="#e2e8f0"/>
        </g>

        {/* Main document */}
        <g className="doc-main" style={{filter:"drop-shadow(0 8px 28px rgba(0,0,0,0.10))"}}>
          <rect x="57" y="19" width="210" height="278" rx="10" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1"/>
          {/* Header bar */}
          <rect x="57" y="19" width="210" height="40" rx="10" fill="#f8fafc"/>
          <rect x="57" y="45" width="210" height="14" fill="#f8fafc"/>
          {/* File icon */}
          <rect x="72" y="28" width="18" height="22" rx="3" fill="#dbeafe"/>
          <path d="M82 28 L90 36 L90 50 L72 50 L72 28 Z" fill="none" stroke="#93c5fd" strokeWidth="0.8"/>
          <path d="M82 28 L82 36 L90 36" fill="#bfdbfe"/>
          {/* Title */}
          <rect x="96" y="31" width="72" height="7" rx="3.5" fill="#1e40af" opacity="0.85"/>
          <rect x="96" y="43" width="46" height="5" rx="2.5" fill="#94a3b8"/>
          {/* Divider */}
          <line x1="68" y1="61" x2="255" y2="61" stroke="#f1f5f9" strokeWidth="1"/>
          {/* Content lines */}
          <g className="l1">
            <rect x="68" y="70" width="142" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="68" y="80" width="108" height="5" rx="2.5" fill="#f1f5f9"/>
          </g>
          <g className="l2">
            <rect x="68" y="94" width="158" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="68" y="104" width="92" height="5" rx="2.5" fill="#f1f5f9"/>
          </g>
          <g className="l3">
            <rect x="68" y="118" width="132" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="68" y="128" width="122" height="5" rx="2.5" fill="#f1f5f9"/>
          </g>
          <g className="l4">
            <rect x="68" y="142" width="152" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="68" y="152" width="78" height="5" rx="2.5" fill="#f1f5f9"/>
          </g>
          <g className="l5">
            <rect x="68" y="166" width="126" height="6" rx="3" fill="#e2e8f0"/>
            <rect x="68" y="176" width="106" height="5" rx="2.5" fill="#f1f5f9"/>
          </g>
          {/* Signature box */}
          <rect x="68" y="196" width="188" height="62" rx="7" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1"/>
          <text x="76" y="211" fontSize="7" fill="#86efac" fontFamily="system-ui,sans-serif">Signed by:</text>
          {/* Animated signature */}
          <path className="sig-path" d="M80 237 C90 222 98 250 114 233 C127 218 136 246 154 229 C168 215 176 242 194 231 C204 223 210 236 220 229" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
          <text x="76" y="254" fontSize="6.5" fill="#86efac" fontFamily="monospace">B862782D60212...</text>
          {/* Checkmark */}
          <g className="chk">
            <circle cx="78" cy="270" r="7.5" fill="#16a34a"/>
            <path d="M74.5 270 L77.2 272.8 L82 267" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
          <text x="91" y="273" fontSize="7.5" fill="#15803d" fontFamily="system-ui,sans-serif" fontWeight="500">Digitally verified</text>
          <text x="178" y="273" fontSize="7" fill="#86efac" fontFamily="system-ui,sans-serif">3 Jun 2026</text>
        </g>

        {/* Shield badge top-left */}
        <g className="shield">
          <rect x="28" y="28" width="28" height="28" rx="8" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="0.8"/>
          <path d="M42 35 C42 35 37 38 37 42.5 C37 46.5 39.5 48.5 42 49.5 C44.5 48.5 47 46.5 47 42.5 C47 38 42 35 42 35Z" fill="none" stroke="#16a34a" strokeWidth="1.3"/>
          <path d="M39.5 42.5 L41.5 44.5 L45.5 40" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </g>

        {/* Email notification top-right */}
        <g className="notif">
          <rect x="196" y="5" width="118" height="40" rx="9" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8"/>
          <rect x="207" y="15" width="20" height="20" rx="5" fill="#eff6ff"/>
          <text x="217" y="29" fontSize="10" fill="#3b82f6" textAnchor="middle" fontFamily="system-ui,sans-serif">✉</text>
          <text x="232" y="22" fontSize="7.5" fill="#1e293b" fontFamily="system-ui,sans-serif" fontWeight="500">Email sent</text>
          <text x="232" y="33" fontSize="6.5" fill="#94a3b8" fontFamily="system-ui,sans-serif">2 recipients notified</text>
          <circle className="dot-live" cx="307" cy="12" r="4" fill="#16a34a"/>
        </g>

        {/* Completed badge */}
        <g className="badge-done">
          <rect x="108" y="356" width="124" height="36" rx="18" fill="#16a34a"/>
          <circle cx="130" cy="374" r="10" fill="rgba(255,255,255,0.2)"/>
          <path d="M126 374 L129 377 L134.5 370.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <text x="147" y="378" fontSize="11.5" fill="white" fontFamily="system-ui,sans-serif" fontWeight="500">Completed</text>
        </g>

        {/* Recipient pill left */}
        <g className="pill-l">
          <rect x="24" y="292" width="92" height="30" rx="15" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8"/>
          <circle cx="41" cy="307" r="9" fill="#f0fdf4"/>
          <text x="41" y="311" fontSize="9.5" textAnchor="middle" fill="#16a34a" fontFamily="system-ui,sans-serif" fontWeight="500">D</text>
          <text x="54" y="303" fontSize="7.5" fill="#1e293b" fontFamily="system-ui,sans-serif" fontWeight="500">Dhruv</text>
          <text x="54" y="314" fontSize="6.5" fill="#16a34a" fontFamily="system-ui,sans-serif">Signed ✓</text>
        </g>

        {/* Recipient pill right */}
        <g className="pill-r">
          <rect x="228" y="306" width="92" height="30" rx="15" fill="#ffffff" stroke="#e2e8f0" strokeWidth="0.8"/>
          <circle cx="245" cy="321" r="9" fill="#eff6ff"/>
          <text x="245" y="325" fontSize="9.5" textAnchor="middle" fill="#3b82f6" fontFamily="system-ui,sans-serif" fontWeight="500">M</text>
          <text x="258" y="317" fontSize="7.5" fill="#1e293b" fontFamily="system-ui,sans-serif" fontWeight="500">Manan</text>
          <text x="258" y="328" fontSize="6.5" fill="#3b82f6" fontFamily="system-ui,sans-serif">Signed ✓</text>
        </g>
      </svg>
    </div>
  )
}

// ── Hero ────────────────────────────────────────────────────────────────────
function HeroSection() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 50])

  return (
    <motion.section ref={ref} style={{ opacity }} className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-white" />
      <div className="absolute top-20 left-1/4 w-80 h-80 bg-brand-100 rounded-full blur-3xl opacity-50 animate-pulse" />
      <div className="absolute bottom-20 right-1/3 w-64 h-64 bg-emerald-100 rounded-full blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16a34a0a_1px,transparent_1px),linear-gradient(to_bottom,#16a34a0a_1px,transparent_1px)] bg-[size:32px_32px]" />

      <motion.div style={{ y }} className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-20 items-center">

          {/* ── Left: text content ── */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 bg-brand-50 border border-brand-200 rounded-full px-4 py-1.5 text-sm text-brand-700 font-medium mb-8">
              <Zap className="w-3.5 h-3.5" />
              Trusted by 10,000+ businesses worldwide
            </motion.div>

            {/* Headline */}
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl sm:text-6xl lg:text-5xl xl:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
              Sign Documents.{" "}
              <span className="relative">
                <span className="relative z-10 text-brand-600">Instantly.</span>
                <span className="absolute -bottom-1 left-0 right-0 h-3 bg-brand-100 rounded-sm -z-0" />
              </span>
              {" "}Securely.
            </motion.h1>

            {/* Subheading */}
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-gray-500 leading-relaxed mb-10 max-w-xl mx-auto lg:mx-0">
              The fastest way to send, sign, and manage documents — with bank-level encryption,
              legally binding signatures, and a complete audit trail.
            </motion.p>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 mb-12">
              <Link to="/register">
                <Button size="lg" className="px-8 py-6 text-base shadow-lg shadow-brand-200 hover:shadow-xl hover:shadow-brand-200 transition-all hover:-translate-y-0.5">
                  Start for Free
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline" className="px-8 py-6 text-base">
                  See how it works
                </Button>
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }}
              className="flex items-center justify-center lg:justify-start gap-6">
              <div className="flex -space-x-2">
                {["bg-blue-400", "bg-purple-400", "bg-pink-400", "bg-orange-400", "bg-teal-400"].map((bg, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-xs font-bold`}>
                    {["A","B","C","D","E"][i]}
                  </div>
                ))}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">4.9 / 5 from 2,400+ reviews</p>
              </div>
            </motion.div>
          </div>

          {/* ── Right: animated document ── */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:flex items-center justify-center"
          >
            <AnimatedDocument />
          </motion.div>

        </div>
      </motion.div>
    </motion.section>
  )
}

// ── Features ────────────────────────────────────────────────────────────────
// ── Features WebGL Shader background ──────────────────────────────────────
function FeaturesShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext("webgl")
    if (!gl) return

    const vert = `
      attribute vec3 position;
      void main() { gl_Position = vec4(position, 1.0); }
    `
    const frag = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);

        float r  = 0.012 / abs(p.y + sin((p.x + time)        * xScale) * yScale * 1.0);
        float g1 = 0.014 / abs(p.y + sin((p.x + time * 0.80) * xScale * 0.9) * yScale * 0.85 + 0.12);
        float g2 = 0.010 / abs(p.y + sin((p.x + time * 1.05) * xScale * 1.1) * yScale * 1.0  - 0.08);
        float b  = 0.009 / abs(p.y + sin((p.x + time * 0.65) * xScale * 1.2) * yScale * 0.65 + 0.20);

        vec3 forest  = vec3(0.03, 0.32, 0.16);
        vec3 emerald = vec3(0.04, 0.55, 0.35);
        vec3 teal    = vec3(0.06, 0.42, 0.40);
        vec3 lime    = vec3(0.28, 0.58, 0.18);

        vec3 col = forest * r + emerald * g1 + teal * g2 + lime * b;
        col = pow(col, vec3(0.9));
        gl_FragColor = vec4(col, 1.0);
      }
    `

    const mkShader = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src); gl.compileShader(s); return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, mkShader(gl.VERTEX_SHADER, vert))
    gl.attachShader(prog, mkShader(gl.FRAGMENT_SHADER, frag))
    gl.linkProgram(prog); gl.useProgram(prog)

    const verts = new Float32Array([-1,-1,0, 1,-1,0, -1,1,0, 1,-1,0, -1,1,0, 1,1,0])
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(prog, "position")
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 3, gl.FLOAT, false, 0, 0)

    const uRes  = gl.getUniformLocation(prog, "resolution")
    const uTime = gl.getUniformLocation(prog, "time")
    const uXS   = gl.getUniformLocation(prog, "xScale")
    const uYS   = gl.getUniformLocation(prog, "yScale")

    // Reduced intensity — softer lines, less visual noise
    gl.uniform1f(uXS, 0.8)
    gl.uniform1f(uYS, 0.32)

    let t = 0, animId: number

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    resize()
    window.addEventListener("resize", resize)

    const draw = () => {
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (t += 0.004))
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animId = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
      style={{ zIndex: 0 }}
    />
  )
}

// ── Features ────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    {
      icon: <Send className="w-6 h-6 text-emerald-300" />,
      title: "Send in Seconds",
      description: "Upload any PDF, add signature fields, assign recipients and send — all in under 60 seconds.",
    },
    {
      icon: <Shield className="w-6 h-6 text-teal-300" />,
      title: "Legally Binding",
      description: "Every signature is backed by PKCS#7 cryptographic certificates and a complete audit trail.",
    },
    {
      icon: <Activity className="w-6 h-6 text-green-300" />,
      title: "Track Everything",
      description: "Real-time notifications when documents are opened, signed, or completed.",
    },
    {
      icon: <Lock className="w-6 h-6 text-emerald-300" />,
      title: "AES-256 Encryption",
      description: "All documents are encrypted at rest using AES-256-CBC. Your files are always protected.",
    },
    {
      icon: <Users className="w-6 h-6 text-teal-300" />,
      title: "Multi-Recipient",
      description: "Send to multiple signers. Each gets their own secure signing link and visual stamp.",
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-green-300" />,
      title: "Certificate of Completion",
      description: "Every completed envelope includes a signed Certificate of Completion for your records.",
    },
  ]

  return (
    <section id="features" className="relative py-28 overflow-hidden bg-gray-950">

      {/* WebGL shader — subtle, not overwhelming */}
      <FeaturesShader />

      {/* Thick dark overlay — ensures text is always readable */}
      <div className="absolute inset-0 bg-black/75 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Content — sits above both shader and overlay */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ zIndex: 2 }}>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block bg-white/10 backdrop-blur-sm border border-emerald-500/30 text-emerald-300 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            Features
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Everything you need
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Powerful tools built for modern document workflows — from startup to enterprise.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
            >
              {/* Card — solid dark background, no transparency issues */}
              <div className="h-full bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl p-7 space-y-4 hover:bg-white/15 hover:border-emerald-500/40 transition-all duration-300 group cursor-default">
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-900/50 transition-all">
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                <p className="text-gray-400 leading-relaxed text-sm">{f.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}
// ── How it works illustrations ─────────────────────────────────────────────
function UploadIllustration() {
  return (
    <div style={{ position: "relative", width: "100%", height: "140px" }}>
      <style>{`
        @keyframes uploadDrop { 0%{transform:translateY(-40px);opacity:0} 60%{transform:translateY(4px);opacity:1} 100%{transform:translateY(0);opacity:1} }
        @keyframes progressFill { 0%{width:0} 100%{width:100%} }
        @keyframes checkPopIll { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.3)} 100%{transform:scale(1);opacity:1} }
        @keyframes fieldAppear { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes cursorMove { 0%{transform:translate(10px,10px)} 33%{transform:translate(60px,36px)} 66%{transform:translate(60px,62px)} 100%{transform:translate(10px,10px)} }
        @keyframes planefly { 0%{transform:translate(0,0) rotate(-10deg);opacity:1} 60%{transform:translate(120px,-30px) rotate(-10deg);opacity:1} 100%{transform:translate(120px,-30px) rotate(-10deg);opacity:0} }
        @keyframes badgePopIll { 0%{opacity:0;transform:scale(0)} 70%{transform:scale(1.15)} 100%{opacity:1;transform:scale(1)} }
        @keyframes drawSigIll { 0%{stroke-dashoffset:160} 100%{stroke-dashoffset:0} }
        @keyframes signedPop { 0%{opacity:0;transform:scale(0) translateY(8px)} 70%{transform:scale(1.1) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes floatDoc { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.4);opacity:0} }
      `}</style>
      <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:140,height:80,border:"2px dashed #86efac",borderRadius:10,background:"#f0fdf4",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
        <span style={{fontSize:10,color:"#16a34a",fontWeight:500}}>Drop files here</span>
        <div style={{width:90,height:4,background:"#bbf7d0",borderRadius:4,overflow:"hidden",marginTop:2}}>
          <div style={{height:"100%",background:"#16a34a",borderRadius:4,animation:"progressFill 3.5s ease-in-out 2s infinite",width:0}} />
        </div>
      </div>
      <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",animation:"uploadDrop 3.5s ease-in-out 0.5s infinite"}}>
        <div style={{width:48,background:"#fff",border:"1.5px solid #bbf7d0",borderRadius:6,padding:6,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
          <div style={{background:"#dbeafe",borderRadius:2,height:28,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:4}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
          </div>
          <div style={{height:3,background:"#e2e8f0",borderRadius:2,marginBottom:2}} />
          <div style={{height:3,background:"#e2e8f0",borderRadius:2,width:"70%"}} />
        </div>
      </div>
      <div style={{position:"absolute",bottom:6,right:"15%",animation:"checkPopIll 0.8s ease-out 5s infinite",opacity:0}}>
        <div style={{width:20,height:20,background:"#16a34a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      </div>
    </div>
  )
}

function FieldsIllustration() {
  return (
    <div style={{position:"relative",width:"100%",height:"140px",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",border:"1.5px solid #bfdbfe",borderRadius:8,padding:"10px 12px",width:150,animation:"floatDoc 5s ease-in-out infinite"}}>
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,marginBottom:5}} />
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,width:"80%",marginBottom:5}} />
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,marginBottom:10}} />
        {[
          {color:"#3b82f6",bg:"#eff6ff",border:"#93c5fd",label:"Signature",delay:"1s"},
          {color:"#7c3aed",bg:"#f5f3ff",border:"#c4b5fd",label:"Date",delay:"2s"},
          {color:"#0d9488",bg:"#f0fdfa",border:"#99f6e4",label:"Initials",delay:"3s"},
        ].map(f => (
          <div key={f.label} style={{height:22,border:`1.5px dashed ${f.border}`,borderRadius:4,background:f.bg,display:"flex",alignItems:"center",padding:"0 6px",marginBottom:5,animation:`fieldAppear 0.8s ease forwards ${f.delay}`,opacity:0}}>
            <span style={{fontSize:9,color:f.color,fontWeight:500}}>{f.label}</span>
          </div>
        ))}
      </div>
      <div style={{position:"absolute",top:10,right:"10%",animation:"cursorMove 6s ease-in-out infinite"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1e40af" stroke="white" strokeWidth="1"><path d="M5 3l14 9-7 1-4 7z" /></svg>
      </div>
    </div>
  )
}

function SendIllustration() {
  return (
    <div style={{position:"relative",width:"100%",height:"140px"}}>
      <div style={{position:"absolute",left:"5%",top:"30%",width:36,height:44,background:"#fff",border:"1.5px solid #e9d5ff",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>
      </div>
      <div style={{position:"absolute",left:"20%",top:"44%",animation:"planefly 4.5s ease-in-out 0.8s infinite"}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#7c3aed"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
      </div>
      {[
        {top:"5%",bottom:undefined,letter:"D",bg:"#dcfce7",color:"#16a34a",border:"#bbf7d0",nameTxt:"Dhruv",badgeBg:"#f0fdf4",badgeBorder:"#bbf7d0",badgeColor:"#15803d",delay:"4"},
        {top:undefined,bottom:"5%",letter:"M",bg:"#eff6ff",color:"#2563eb",border:"#bfdbfe",nameTxt:"Manan",badgeBg:"#eff6ff",badgeBorder:"#bfdbfe",badgeColor:"#1d4ed8",delay:"5"},
      ].map(r => (
        <div key={r.letter} style={{position:"absolute",right:"5%",top:r.top,bottom:r.bottom,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <div style={{position:"relative"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:r.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:600,color:r.color,border:`2px solid ${r.border}`}}>{r.letter}</div>
            <div style={{position:"absolute",inset:-3,borderRadius:"50%",border:`2px solid ${r.color}`,animation:`pulseRing 3s ease-out ${r.delay}s infinite`}} />
          </div>
          <span style={{fontSize:10,color:"#374151",fontWeight:500}}>{r.nameTxt}</span>
          <div style={{background:r.badgeBg,border:`1px solid ${r.badgeBorder}`,borderRadius:5,padding:"2px 6px",animation:`badgePopIll 0.8s ease-out ${parseFloat(r.delay)+0.2}s infinite`,opacity:0}}>
            <span style={{fontSize:9,color:r.badgeColor,fontWeight:500}}>Sent ✓</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function SignIllustration() {
  return (
    <div style={{position:"relative",width:"100%",height:"140px",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",border:"1.5px solid #bbf7d0",borderRadius:10,padding:"12px 14px",width:160,animation:"floatDoc 5s ease-in-out 0.5s infinite"}}>
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,marginBottom:4}} />
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,width:"75%",marginBottom:4}} />
        <div style={{height:5,background:"#e2e8f0",borderRadius:3,marginBottom:12}} />
        <div style={{border:"1.5px dashed #86efac",borderRadius:6,padding:8,background:"#f0fdf4",marginBottom:8}}>
          <div style={{fontSize:9,color:"#86efac",marginBottom:4}}>Signed by:</div>
          <svg width="130" height="28" viewBox="0 0 130 28" style={{overflow:"visible"}}>
            <path d="M8 20 C18 8 26 26 40 14 C52 4 62 22 78 12 C90 4 100 18 120 12" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="160" strokeDashoffset="160" style={{animation:"drawSigIll 2.8s ease forwards 1s infinite"}} />
          </svg>
        </div>
        <div style={{display:"flex",justifyContent:"center",animation:"signedPop 0.8s cubic-bezier(.17,.67,.35,1.4) forwards 4s infinite",opacity:0}}>
          <div style={{background:"#16a34a",borderRadius:999,padding:"4px 12px",display:"flex",alignItems:"center",gap:5}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            <span style={{fontSize:10,color:"white",fontWeight:600}}>Completed</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── How it works ─────────────────────────────────────────────────────────────
export function HowItWorksSection() {
  const steps = [
    {
      num: "01", bg: "#f0fdf4", ghostColor: "#dcfce7", iconBg: "#16a34a",
      icon: <FileText className="w-4 h-4 text-white" />,
      title: "Upload your document",
      desc: "Drag and drop any PDF. We accept all document types up to 25MB. Your file is encrypted immediately on upload.",
      illustration: <UploadIllustration />,
    },
    {
      num: "02", bg: "#eff6ff", ghostColor: "#dbeafe", iconBg: "#3b82f6",
      icon: <Send className="w-4 h-4 text-white" />,
      title: "Add signature fields",
      desc: "Place signature, initials, date and text fields exactly where needed. Assign each field to a specific recipient.",
      illustration: <FieldsIllustration />,
    },
    {
      num: "03", bg: "#fdf4ff", ghostColor: "#f3e8ff", iconBg: "#7c3aed",
      icon: <Users className="w-4 h-4 text-white" />,
      title: "Send to recipients",
      desc: "Add one or more signers. Each gets a unique secure link via email. No account needed — works on any device.",
      illustration: <SendIllustration />,
    },
    {
      num: "04", bg: "#f0fdf4", ghostColor: "#dcfce7", iconBg: "#16a34a",
      icon: <CheckCircle className="w-4 h-4 text-white" />,
      title: "Get it signed",
      desc: "Recipients sign with a legally binding PKCS#7 digital signature. Download the signed PDF with a Certificate of Completion.",
      illustration: <SignIllustration />,
    },
  ]

  return (
    <section id="how-it-works" className="py-28 bg-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16a34a06_1px,transparent_1px),linear-gradient(to_bottom,#16a34a06_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <span className="inline-block bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            How it works
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Four steps to done</h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Go from document upload to signed in minutes — not days.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.1 }}>
              <Card className="h-full bg-white overflow-hidden hover:border-brand-200 hover:shadow-lg hover:shadow-brand-50 transition-all duration-300 group">
                <div style={{ background: step.bg, padding: "28px 20px 20px", height: 200, position: "relative", overflow: "hidden" }}>
                  <span style={{ position: "absolute", top: 14, left: 16, fontSize: 48, fontWeight: 900, color: step.ghostColor, lineHeight: 1, userSelect: "none" }}>{step.num}</span>
                  <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "85%" }}>
                    {step.illustration}
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform" style={{ background: step.iconBg }}>
                      {step.icon}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{step.title}</h3>
                  </div>
                  <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Security section ─────────────────────────────────────────────────────────
// ── Security animated illustration ────────────────────────────────────────
function SecurityIllustration() {
  return (
    <div className="relative w-full select-none">
      <svg viewBox="0 0 480 380" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <defs>
          <style>{`
            @keyframes secRing1{0%,100%{opacity:0.07}50%{opacity:0.14}}
            @keyframes secRing2{0%,100%{opacity:0.05}50%{opacity:0.10}}
            @keyframes secRing3{0%,100%{opacity:0.03}50%{opacity:0.07}}
            @keyframes secFloat1{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(-6deg)}}
            @keyframes secFloat2{0%,100%{transform:translateY(0) rotate(5deg)}50%{transform:translateY(-7px) rotate(5deg)}}
            @keyframes secFloat3{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-9px) rotate(-2deg)}}
            @keyframes secLock{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
            @keyframes secChk{0%{opacity:0;transform:scale(0)}60%{transform:scale(1.25)}100%{opacity:1;transform:scale(1)}}
            @keyframes secOrbit1{0%{transform:rotate(0deg) translateX(75px) rotate(0deg)}100%{transform:rotate(360deg) translateX(75px) rotate(-360deg)}}
            @keyframes secOrbit2{0%{transform:rotate(120deg) translateX(75px) rotate(-120deg)}100%{transform:rotate(480deg) translateX(75px) rotate(-480deg)}}
            @keyframes secOrbit3{0%{transform:rotate(240deg) translateX(75px) rotate(-240deg)}100%{transform:rotate(600deg) translateX(75px) rotate(-600deg)}}
            @keyframes secLine{0%{stroke-dashoffset:160}100%{stroke-dashoffset:0}}
            @keyframes secBadge{0%{opacity:0;transform:scale(0)}60%{transform:scale(1.1)}100%{opacity:1;transform:scale(1)}}
            .sr1{animation:secRing1 3s ease-in-out infinite}
            .sr2{animation:secRing2 3s ease-in-out infinite 0.5s}
            .sr3{animation:secRing3 3s ease-in-out infinite 1s}
            .sf1{animation:secFloat1 5s ease-in-out infinite;transform-origin:145px 185px}
            .sf2{animation:secFloat2 5.5s ease-in-out infinite 0.5s;transform-origin:335px 175px}
            .sf3{animation:secFloat3 4.5s ease-in-out infinite 1s;transform-origin:240px 310px}
            .slk{animation:secLock 4s ease-in-out infinite;transform-origin:240px 195px}
            .sc1{animation:secChk 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 1.2s;opacity:0}
            .sc2{animation:secChk 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 1.7s;opacity:0}
            .sc3{animation:secChk 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 2.2s;opacity:0}
            .so1{animation:secOrbit1 7s linear infinite;transform-origin:240px 195px}
            .so2{animation:secOrbit2 7s linear infinite;transform-origin:240px 195px}
            .so3{animation:secOrbit3 7s linear infinite;transform-origin:240px 195px}
            .sl1{stroke-dasharray:160;stroke-dashoffset:160;animation:secLine 1.4s ease forwards 0.4s}
            .sl2{stroke-dasharray:160;stroke-dashoffset:160;animation:secLine 1.4s ease forwards 0.7s}
            .sl3{stroke-dasharray:160;stroke-dashoffset:160;animation:secLine 1.4s ease forwards 1.0s}
            .sb1{animation:secBadge 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 2.4s;opacity:0;transform-origin:390px 88px}
            .sb2{animation:secBadge 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 2.7s;opacity:0;transform-origin:390px 305px}
            .sb3{animation:secBadge 0.45s cubic-bezier(.17,.67,.35,1.4) forwards 3.0s;opacity:0;transform-origin:88px 100px}
          `}</style>
        </defs>

        {/* Pulse rings */}
        <circle cx="240" cy="195" r="140" fill="#16a34a" className="sr3"/>
        <circle cx="240" cy="195" r="105" fill="#16a34a" className="sr2"/>
        <circle cx="240" cy="195" r="70" fill="#16a34a" className="sr1"/>

        {/* Orbit ring */}
        <circle cx="240" cy="195" r="75" fill="none" stroke="#16a34a" strokeWidth="0.8" strokeDasharray="4 6" opacity="0.3"/>

        {/* Orbiting dots */}
        <g className="so1"><circle cx="240" cy="195" r="5" fill="#16a34a" opacity="0.7"/></g>
        <g className="so2"><circle cx="240" cy="195" r="4" fill="#16a34a" opacity="0.5"/></g>
        <g className="so3"><circle cx="240" cy="195" r="3" fill="#15803d" opacity="0.4"/></g>

        {/* Shield */}
        <g className="slk">
          <path d="M240 148 C240 148 212 156 212 175 C212 194 226 203 240 208 C254 203 268 194 268 175 C268 156 240 148 240 148Z" fill="#f0fdf4" stroke="#16a34a" strokeWidth="1.5"/>
          <path d="M240 150 C240 150 214 158 214 176 C214 193 227 202 240 207 C253 202 266 193 266 176 C266 158 240 150 240 150Z" fill="#dcfce7" stroke="none"/>
          <rect x="232" y="177" width="16" height="12" rx="3" fill="#16a34a"/>
          <path d="M235 177 L235 173 C235 170.5 237.5 169 240 169 C242.5 169 245 170.5 245 173 L245 177" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="240" cy="183" r="2" fill="white"/>
        </g>

        {/* Connector lines */}
        <line x1="218" y1="182" x2="175" y2="205" stroke="#bbf7d0" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7"/>
        <line x1="262" y1="182" x2="305" y2="198" stroke="#bbf7d0" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7"/>
        <line x1="240" y1="208" x2="240" y2="295" stroke="#bbf7d0" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.7"/>

        {/* Doc 1 — left */}
        <g className="sf1">
          <rect x="96" y="154" width="80" height="98" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <rect x="96" y="154" width="80" height="20" rx="6" fill="#f8fafc"/>
          <rect x="96" y="167" width="80" height="7" fill="#f8fafc"/>
          <rect x="105" y="159" width="11" height="13" rx="2" fill="#dbeafe"/>
          <rect x="120" y="161" width="36" height="4.5" rx="2" fill="#1e40af" opacity="0.75"/>
          <line x1="105" y1="180" x2="167" y2="180" stroke="#f1f5f9" strokeWidth="0.8"/>
          <rect x="105" y="185" width="54" height="3.5" rx="2" fill="#e2e8f0"/>
          <rect x="105" y="192" width="44" height="3.5" rx="2" fill="#f1f5f9"/>
          <rect x="105" y="199" width="58" height="3.5" rx="2" fill="#e2e8f0"/>
          <rect x="103" y="211" width="64" height="26" rx="4" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="0.8"/>
          <path className="sl1" d="M108 224 C113 219 117 228 122 222 C126 217 130 225 136 221 C140 217 143 222 148 219" fill="none" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round"/>
          <g className="sc1">
            <circle cx="172" cy="224" r="8" fill="#16a34a"/>
            <path d="M168.5 224 L171 226.5 L176 221" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
        </g>

        {/* Doc 2 — right */}
        <g className="sf2">
          <rect x="304" y="148" width="80" height="98" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <rect x="304" y="148" width="80" height="20" rx="6" fill="#f8fafc"/>
          <rect x="304" y="161" width="80" height="7" fill="#f8fafc"/>
          <rect x="313" y="153" width="11" height="13" rx="2" fill="#dbeafe"/>
          <rect x="328" y="155" width="36" height="4.5" rx="2" fill="#1e40af" opacity="0.75"/>
          <line x1="313" y1="174" x2="375" y2="174" stroke="#f1f5f9" strokeWidth="0.8"/>
          <rect x="313" y="179" width="54" height="3.5" rx="2" fill="#e2e8f0"/>
          <rect x="313" y="186" width="44" height="3.5" rx="2" fill="#f1f5f9"/>
          <rect x="313" y="193" width="58" height="3.5" rx="2" fill="#e2e8f0"/>
          <rect x="311" y="205" width="64" height="26" rx="4" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="0.8"/>
          <path className="sl2" d="M316 218 C321 213 325 222 330 216 C334 211 338 219 344 215 C348 211 351 216 356 213" fill="none" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round"/>
          <g className="sc2">
            <circle cx="380" cy="218" r="8" fill="#16a34a"/>
            <path d="M376.5 218 L379 220.5 L384 215" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
        </g>

        {/* Doc 3 — bottom */}
        <g className="sf3">
          <rect x="200" y="295" width="80" height="88" rx="6" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
          <rect x="200" y="295" width="80" height="20" rx="6" fill="#f8fafc"/>
          <rect x="200" y="308" width="80" height="7" fill="#f8fafc"/>
          <rect x="209" y="300" width="11" height="13" rx="2" fill="#dbeafe"/>
          <rect x="224" y="302" width="36" height="4.5" rx="2" fill="#1e40af" opacity="0.75"/>
          <line x1="209" y1="321" x2="271" y2="321" stroke="#f1f5f9" strokeWidth="0.8"/>
          <rect x="209" y="326" width="54" height="3.5" rx="2" fill="#e2e8f0"/>
          <rect x="209" y="333" width="44" height="3.5" rx="2" fill="#f1f5f9"/>
          <rect x="207" y="345" width="64" height="26" rx="4" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="0.8"/>
          <path className="sl3" d="M212 358 C217 353 221 362 226 356 C230 351 234 359 240 355 C244 351 247 356 252 353" fill="none" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round"/>
          <g className="sc3">
            <circle cx="276" cy="358" r="8" fill="#16a34a"/>
            <path d="M272.5 358 L275 360.5 L280 355" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </g>
        </g>

        {/* PKCS#7 badge */}
        <g className="sb1">
          <rect x="346" y="74" width="88" height="26" rx="13" fill="#f0fdf4" stroke="#bbf7d0" strokeWidth="1"/>
          <text x="390" y="91" textAnchor="middle" fontSize="10.5" fill="#15803d" fontFamily="system-ui,sans-serif" fontWeight="600">PKCS#7 ✓</text>
        </g>

        {/* AES-256 badge */}
        <g className="sb2">
          <rect x="344" y="292" width="94" height="26" rx="13" fill="#eff6ff" stroke="#bfdbfe" strokeWidth="1"/>
          <text x="391" y="309" textAnchor="middle" fontSize="10.5" fill="#1d4ed8" fontFamily="system-ui,sans-serif" fontWeight="600">AES-256 ✓</text>
        </g>

        {/* SHA-256 badge */}
        <g className="sb3">
          <rect x="40" y="86" width="94" height="26" rx="13" fill="#fdf4ff" stroke="#e9d5ff" strokeWidth="1"/>
          <text x="87" y="103" textAnchor="middle" fontSize="10.5" fill="#7c3aed" fontFamily="system-ui,sans-serif" fontWeight="600">SHA-256 ✓</text>
        </g>
      </svg>
    </div>
  )
}

// ── Security section ──────────────────────────────────────────────────────
function SecuritySection() {
  const items = [
    { label: "PKCS#7 Digital Signatures", desc: "ISO 32000 compliant cryptographic signatures verifiable in Adobe Acrobat." },
    { label: "Three-tier PKI", desc: "Root CA → Intermediate CA → Leaf certificates. Full certificate chain." },
    { label: "AES-256-CBC Encryption", desc: "All documents encrypted at rest with a random IV per file." },
    { label: "Advanced Identity Verification", desc: "Phone OTP + government ID review for the highest trust level." },
    { label: "Tamper Detection", desc: "SHA-256 hash stored at upload. Verified before every signing ceremony." },
    { label: "Full Audit Trail", desc: "Every event logged — IP address, timestamp, identity level used." },
  ]

  return (
    <section id="security" className="py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left — animation + text */}
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }} className="space-y-8">
            {/* Animated illustration */}
            <SecurityIllustration />
            {/* Text content */}
            <div>
              <span className="inline-block bg-blue-50 border border-blue-200 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
                Enterprise Security
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mb-4">
                Bank-level security.<br />Built in from day one.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-8">
                Every signature is cryptographically verifiable. Every document is encrypted.
                Every action is logged. Security is not an afterthought here.
              </p>
              <Link to="/register">
                <Button size="lg">
                  Start Secure Signing
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Right — security items */}
          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }} className="space-y-4">
            {items.map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.07 }}
                className="flex items-start gap-4 p-4 rounded-xl border border-gray-100 hover:border-brand-200 hover:bg-brand-50/30 transition-all">
                <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                  <p className="text-gray-500 text-sm mt-0.5">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

        </div>
      </div>
    </section>
  )
}


// ── Pricing ───────────────────────────────────────────────────────────────
const pricingPlans = [
  {
    name: "Free",
    price: 0,
    yearlyPrice: 0,
    period: "month",
    features: [
      "3 documents / month",
      "1 signer per document",
      "Basic audit trail",
      "Email notifications",
      "PDF download",
    ],
    description: "Perfect for individuals",
    buttonText: "Get started free",
    href: "/register",
    isPopular: false,
  },
  {
    name: "Pro",
    price: 19,
    yearlyPrice: 15,
    period: "month",
    features: [
      "Unlimited documents",
      "5 signers per document",
      "Full audit trail & certificate",
      "AES-256 encryption",
      "Priority support",
      "Custom branding",
    ],
    description: "Most popular for growing teams",
    buttonText: "Start free trial",
    href: "/register",
    isPopular: true,
  },
  {
    name: "Enterprise",
    price: 49,
    yearlyPrice: 39,
    period: "month",
    features: [
      "Unlimited everything",
      "Unlimited signers",
      "Advanced identity verification",
      "SSO & API access",
      "Dedicated account manager",
      "SLA guarantee",
    ],
    description: "For large organisations",
    buttonText: "Contact sales",
    href: "/register",
    isPopular: false,
  },
]

function PricingSection() {
  const [isMonthly, setIsMonthly] = useState(true)
  const switchRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    const toAnnual = isMonthly
    setIsMonthly(!isMonthly)
    if (toAnnual && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect()
      confetti({
        particleCount: 50,
        spread: 60,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
        colors: ["#16a34a", "#bbf7d0", "#dcfce7", "#4ade80"],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
        shapes: ["circle"],
      })
    }
  }

  return (
    <section id="pricing" className="py-28 bg-gray-50 relative">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16a34a06_1px,transparent_1px),linear-gradient(to_bottom,#16a34a06_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block bg-white border border-gray-200 text-gray-600 text-sm font-medium px-4 py-1.5 rounded-full mb-4">
            Pricing
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing
          </h2>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Choose the plan that works for you. No hidden fees, cancel anytime.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="flex items-center justify-center gap-3 mb-12">
          <span className={cn("text-sm font-medium transition-colors", isMonthly ? "text-gray-900" : "text-gray-400")}>
            Monthly
          </span>
          <button
            ref={switchRef}
            onClick={handleToggle}
            aria-label="Toggle billing period"
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
              isMonthly ? "bg-gray-300" : "bg-brand-600"
            )}
          >
            <span className={cn(
              "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-300 shadow-sm",
              !isMonthly && "translate-x-5"
            )} />
          </button>
          <span className={cn("text-sm font-medium transition-colors", !isMonthly ? "text-gray-900" : "text-gray-400")}>
            Annual
          </span>
          <span className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full">
            Save 20%
          </span>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {pricingPlans.map((plan, index) => {
            const price = isMonthly ? plan.price : plan.yearlyPrice
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{
                  opacity: 1,
                  y: plan.isPopular ? -12 : 0,
                  scale: plan.isPopular ? 1.02 : 0.97,
                }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn("relative", !plan.isPopular && "md:mt-5")}
              >
                <Card className={cn(
                  "h-full flex flex-col overflow-visible",
                  plan.isPopular
                    ? "border-brand-500 border-2 shadow-xl shadow-brand-100"
                    : "border-gray-200"
                )}>
                  {plan.isPopular && (
                    <div className="absolute -top-px right-4 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-b-lg flex items-center gap-1.5 z-10">
                      <Star className="w-3 h-3 fill-white" />
                      Popular
                    </div>
                  )}
                  <CardContent className="p-7 flex flex-col flex-1">
                    <p className="text-sm font-semibold text-gray-500 mb-5">{plan.name}</p>
                    <div className="flex items-baseline justify-center gap-1 mb-1">
                      <span className="text-5xl font-bold text-gray-900 tabular-nums transition-all duration-300">
                        {price === 0 ? "Free" : `$${price}`}
                      </span>
                      {price > 0 && (
                        <span className="text-sm text-gray-400 ml-1">/ {plan.period}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 text-center mb-7">
                      {price === 0 ? "forever" : isMonthly ? "billed monthly" : "billed annually"}
                    </p>
                    <ul className="flex flex-col gap-3 mb-7 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-700">
                          <div className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-2.5 h-2.5 text-brand-600" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <hr className="border-gray-100 mb-5" />
                    <Link to={plan.href}>
                      <Button
                        className={cn("w-full text-sm font-semibold")}
                        variant={plan.isPopular ? "default" : "outline"}
                      >
                        {plan.buttonText}
                      </Button>
                    </Link>
                    <p className="text-xs text-gray-400 text-center mt-3">{plan.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center text-sm text-gray-400 mt-10"
        >
          All plans include a 14-day free trial · No credit card required
        </motion.p>
      </div>
    </section>
  )
}


// ── CTA ───────────────────────────────────────────────────────────────────
function CTASection() {
  return (
    <section className="py-28 bg-gray-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#16a34a10_1px,transparent_1px),linear-gradient(to_bottom,#16a34a10_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/40 rounded-full blur-3xl" />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Ready to go paperless?
          </h2>
          <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
            Join thousands of businesses already using DocuSign to sign documents faster and more securely.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register">
              <Button size="lg" className="px-8 py-6 text-base bg-brand-500 hover:bg-brand-400 text-white shadow-lg shadow-brand-900/50">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="px-8 py-6 text-base border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                Sign In
              </Button>
            </Link>
          </div>
          <p className="text-sm text-gray-600 mt-6">No credit card required · Free to get started</p>
        </motion.div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-gray-400">DocuSign</span>
          </div>
          <p className="text-sm text-gray-600">© {new Date().getFullYear()} DocuSign. All rights reserved.</p>
          <div className="flex items-center gap-6">
            {["Privacy", "Terms", "Security"].map(item => (
              <a key={item} href="#" className="text-sm text-gray-600 hover:text-gray-400 transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ── Main export ───────────────────────────────────────────────────────────
export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <SecuritySection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  )
}