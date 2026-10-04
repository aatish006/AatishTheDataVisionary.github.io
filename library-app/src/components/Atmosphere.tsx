import { memo, useEffect, useRef } from 'react';

/** Slow, warm dust motes drifting through lamplight. Canvas, ~60 particles, pauses when hidden. */
export const Dust = memo(function Dust({ count = 60, className = '' }: { count?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1, raf = 0;
    const parts = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.6,
      vy: 0.004 + Math.random() * 0.012,
      vx: (Math.random() - 0.5) * 0.004,
      phase: Math.random() * Math.PI * 2,
      tw: 0.4 + Math.random() * 1.2,
    }));
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        if (!reduced) {
          p.y -= p.vy * dt;
          p.x += (p.vx + Math.sin(now / 3000 + p.phase) * 0.003) * dt;
          if (p.y < -0.02) {
            p.y = 1.02;
            p.x = Math.random();
          }
        }
        // brighter in the lamp's pool of light (top centre)
        const dx = p.x - 0.5;
        const dy = p.y - 0.15;
        const light = Math.max(0.12, 1 - Math.sqrt(dx * dx * 1.6 + dy * dy) * 1.25);
        const twinkle = 0.65 + 0.35 * Math.sin(now / 1000 * p.tw + p.phase);
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 220, 160, ${0.55 * light * twinkle})`;
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(draw);
    };
    const onVis = () => (document.hidden ? cancelAnimationFrame(raf) : start());
    document.addEventListener('visibilitychange', onVis);
    start();
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [count]);
  return <canvas ref={ref} className={`dust ${className}`} aria-hidden />;
});

// Deterministic pseudo-random so the background shelves never "reshuffle".
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

const SPINE_COLORS = ['#5a2a2a', '#3d2a1f', '#2f3b33', '#6b4a2b', '#2a2f40', '#4a1f28', '#5c4630', '#384234', '#704b36', '#2c2522', '#7a5a35', '#463042'];

/** A wall of softly lit bookshelves made of CSS — used behind the welcome screen. */
export const ShelfWall = memo(function ShelfWall({ rows = 5, perRow = 46, seed = 7 }: { rows?: number; perRow?: number; seed?: number }) {
  const r = rng(seed);
  return (
    <div className="shelfwall" aria-hidden>
      {Array.from({ length: rows }, (_, row) => (
        <div className="shelfwall__row" key={row}>
          <div className="shelfwall__books">
            {Array.from({ length: perRow }, (_, i) => {
              const gap = r() < 0.06;
              const lean = !gap && r() < 0.05;
              const w = 12 + Math.floor(r() * 18);
              const h = 62 + Math.floor(r() * 36);
              const c = SPINE_COLORS[Math.floor(r() * SPINE_COLORS.length)];
              const bands = r() < 0.6;
              return gap ? (
                <span key={i} style={{ width: 10 + r() * 30 }} />
              ) : (
                <span
                  key={i}
                  className={`spine${bands ? ' spine--bands' : ''}`}
                  style={{ width: w, height: `${h}%`, background: c, transform: lean ? `rotate(${r() < 0.5 ? -8 : 8}deg)` : undefined }}
                />
              );
            })}
          </div>
          <div className="shelfwall__plank" />
        </div>
      ))}
    </div>
  );
});
