"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Fetching configuration...",
  "Loading knowledge base...",
  "Syncing restaurant data...",
  "Preparing your dashboard...",
  "Connecting systems...",
];

const LR_DOTS = [
  { delay: "0s",    dur: "1.7s", r: 4,   color: "#3170FC", opacity: 0.95 },
  { delay: "0.55s", dur: "1.7s", r: 3,   color: "#60A5FA", opacity: 0.70 },
  { delay: "1.1s",  dur: "1.7s", r: 2.5, color: "#93C5FD", opacity: 0.50 },
];

const RL_DOTS = [
  { delay: "0.28s", dur: "2.0s", r: 3.5, color: "#A78BFA", opacity: 0.90 },
  { delay: "1.05s", dur: "2.0s", r: 2.5, color: "#C4B5FD", opacity: 0.60 },
];

function DashboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="8" height="8" rx="1.5" />
      <rect x="12" y="2" width="8" height="8" rx="1.5" />
      <rect x="2" y="12" width="8" height="8" rx="1.5" />
      <rect x="12" y="12" width="8" height="8" rx="1.5" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3 3 3 0 0 1-1.5 2.6A3 3 0 0 1 16 17v1a4 4 0 0 1-8 0v-1a3 3 0 0 1-1.5-5.4A3 3 0 0 1 5 9a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4Z" />
      <path d="M9 12h6M12 9v6" />
    </svg>
  );
}

export function PageLoader() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 60);
    const cycle = setInterval(() => {
      setMsgIdx((i) => (i + 1) % MESSAGES.length);
    }, 2200);
    return () => { clearTimeout(show); clearInterval(cycle); };
  }, []);

  return (
    <>
      <style>{`
        @keyframes tnd-ping {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(1.9); opacity: 0; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes tnd-ping2 {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes tnd-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tnd-msg-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tnd-loader-wrap {
          animation: tnd-fade-in 0.4s ease both;
        }
        .tnd-ping-a {
          animation: tnd-ping 2s ease-out infinite;
        }
        .tnd-ping-b {
          animation: tnd-ping2 2s ease-out infinite 0.4s;
        }
        .tnd-msg {
          animation: tnd-msg-in 0.3s ease both;
        }
      `}</style>

      <div
        className={`tnd-loader-wrap flex flex-col items-center justify-center h-full min-h-[340px] w-full px-8 py-16 transition-opacity duration-500 ${visible ? "opacity-100" : "opacity-0"}`}
      >
        {/* — Two-system sync diagram — */}
        <svg
          viewBox="0 0 480 180"
          width="480"
          height="180"
          style={{ maxWidth: "100%", overflow: "visible" }}
          aria-hidden="true"
        >
          <defs>
            {/* Glow filters */}
            <filter id="tnd-glow-blue" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="tnd-glow-violet" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id="tnd-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>

            {/* Path definitions — the two nodes sit at (80,90) and (400,90) */}
            <path id="tnd-path-lr" d="M 80,90 C 155,20 325,160 400,90" fill="none" />
            <path id="tnd-path-rl" d="M 400,90 C 325,160 155,20 80,90" fill="none" />
          </defs>

          {/* ─── Connection track (faint) ─── */}
          <path
            d="M 80,90 C 155,20 325,160 400,90"
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
          />
          <path
            d="M 80,90 C 155,160 325,20 400,90"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="1"
            strokeDasharray="3 8"
          />

          {/* ─── Dots L → R (blue = requests) ─── */}
          {LR_DOTS.map((d, i) => (
            <circle key={`lr-${i}`} r={d.r} fill={d.color} opacity={d.opacity} filter="url(#tnd-dot-glow)">
              <animateMotion
                dur={d.dur}
                begin={d.delay}
                repeatCount="indefinite"
                rotate="none"
              >
                <mpath href="#tnd-path-lr" />
              </animateMotion>
            </circle>
          ))}

          {/* ─── Dots R → L (violet = responses) ─── */}
          {RL_DOTS.map((d, i) => (
            <circle key={`rl-${i}`} r={d.r} fill={d.color} opacity={d.opacity} filter="url(#tnd-dot-glow)">
              <animateMotion
                dur={d.dur}
                begin={d.delay}
                repeatCount="indefinite"
                rotate="none"
              >
                <mpath href="#tnd-path-rl" />
              </animateMotion>
            </circle>
          ))}

          {/* ─── Left node: Dashboard ─── */}
          {/* Outer ping ring A */}
          <circle cx="80" cy="90" r="34" fill="none" stroke="#3170FC" strokeWidth="1" opacity="0.5" className="tnd-ping-a" style={{ transformOrigin: "80px 90px" }} />
          {/* Outer ping ring B */}
          <circle cx="80" cy="90" r="30" fill="none" stroke="#3170FC" strokeWidth="1" opacity="0.3" className="tnd-ping-b" style={{ transformOrigin: "80px 90px" }} />
          {/* Node circle */}
          <circle cx="80" cy="90" r="30" fill="rgba(49,112,252,0.12)" stroke="#3170FC" strokeWidth="1.5" filter="url(#tnd-glow-blue)" />
          <circle cx="80" cy="90" r="30" fill="url(#tnd-node-left-fill)" />
          {/* Icon — centered at (80,90), 22×22 → offset (-11,-11) */}
          <g transform="translate(69,79)" fill="none" stroke="#60A5FA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="0" y="0" width="7" height="7" rx="1" />
            <rect x="9" y="0" width="7" height="7" rx="1" />
            <rect x="0" y="9" width="7" height="7" rx="1" />
            <rect x="9" y="9" width="7" height="7" rx="1" />
          </g>
          {/* Label */}
          <text x="80" y="134" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily="system-ui,sans-serif" letterSpacing="0.05em">DASHBOARD</text>

          {/* ─── Right node: AI Brain ─── */}
          <circle cx="400" cy="90" r="34" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.5" className="tnd-ping-a" style={{ transformOrigin: "400px 90px", animationDelay: "0.7s" }} />
          <circle cx="400" cy="90" r="30" fill="none" stroke="#8B5CF6" strokeWidth="1" opacity="0.3" className="tnd-ping-b" style={{ transformOrigin: "400px 90px", animationDelay: "1.1s" }} />
          <circle cx="400" cy="90" r="30" fill="rgba(139,92,246,0.12)" stroke="#8B5CF6" strokeWidth="1.5" filter="url(#tnd-glow-violet)" />
          {/* Brain-like icon (sparkle/neural) */}
          <g transform="translate(389,79)" fill="none" stroke="#A78BFA" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="5" />
            <line x1="11" y1="0" x2="11" y2="4" />
            <line x1="11" y1="18" x2="11" y2="22" />
            <line x1="0" y1="11" x2="4" y2="11" />
            <line x1="18" y1="11" x2="22" y2="11" />
            <line x1="3.2" y1="3.2" x2="6.1" y2="6.1" />
            <line x1="15.9" y1="15.9" x2="18.8" y2="18.8" />
            <line x1="18.8" y1="3.2" x2="15.9" y2="6.1" />
            <line x1="6.1" y1="15.9" x2="3.2" y2="18.8" />
          </g>
          <text x="400" y="134" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="11" fontFamily="system-ui,sans-serif" letterSpacing="0.05em">AI BRAIN</text>

          {/* ─── Centre label ─── */}
          <text x="240" y="175" textAnchor="middle" fill="rgba(255,255,255,0.18)" fontSize="10" fontFamily="system-ui,sans-serif" letterSpacing="0.08em">SYNCING</text>
        </svg>

        {/* ─── Status message ─── */}
        <div
          key={msgIdx}
          className="tnd-msg mt-8 text-sm font-medium tracking-wide"
          style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em" }}
        >
          {MESSAGES[msgIdx]}
        </div>

        {/* ─── Legend ─── */}
        <div className="mt-4 flex items-center gap-5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px" }}>
          <span className="flex items-center gap-1.5">
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#3170FC" }} />
            Requests
          </span>
          <span className="flex items-center gap-1.5">
            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#A78BFA" }} />
            Responses
          </span>
        </div>
      </div>
    </>
  );
}
