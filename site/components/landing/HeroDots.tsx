"use client";

import { useEffect, useRef } from "react";

export function HeroDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    let W = 0;
    let H = 0;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const SPACING = 36;
    const ARM = 3.5;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * DPR;
      canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };

    let t = 0;
    let last = 0;

    const draw = (now: number) => {
      rafRef.current = requestAnimationFrame(draw);

      // throttle to ~10fps — slow wave doesn't need 60fps
      if (now - last < 100) return;
      last = now;

      ctx.clearRect(0, 0, W, H);
      t += 0.08;

      const cx = W / 2;
      const cy = H / 2;
      const rxSq = (W * 0.32) ** 2;
      const rySq = (H * 0.30) ** 2;

      const cols = Math.ceil(W / SPACING) + 1;
      const rows = Math.ceil(H / SPACING) + 1;

      ctx.lineWidth = 0.8;
      ctx.lineCap = "round";

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * SPACING;
          const y = row * SPACING;

          const dx = x - cx;
          const dy = y - cy;
          // squared ellipse distance — skip sqrt
          const ellipseDist = (dx * dx) / rxSq + (dy * dy) / rySq;
          const fade = Math.min(ellipseDist / 1.2, 1);

          // wave using squared dist (cheaper, same visual)
          const distSq = dx * dx + dy * dy;
          const wave = Math.sin(distSq * 0.00004 - t * 3) * 0.5 + 0.5;
          const alpha = fade * (0.06 + wave * 0.20);

          ctx.strokeStyle = `rgba(168,162,158,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(x - ARM, y);
          ctx.lineTo(x + ARM, y);
          ctx.moveTo(x, y - ARM);
          ctx.lineTo(x, y + ARM);
          ctx.stroke();
        }
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
      style={{ zIndex: 0 }}
    />
  );
}
