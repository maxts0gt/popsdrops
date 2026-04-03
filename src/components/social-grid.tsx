"use client";

import { useRef, useEffect, useCallback } from "react";

// Lightweight symbols — small, delicate, atmospheric
const CHARS = ["·", "♡", "✦", "○", "♥", "+", "△", "◇", "★", "◦"];

const CELL = 20;
const FONT_SIZE = 9;
const BASE_ALPHA = 0.06;
const HOVER_RADIUS = 200;
const HOVER_ALPHA = 0.4;

export function SocialGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const gridRef = useRef<{ char: string; x: number; y: number }[]>([]);
  const rafRef = useRef<number>(0);
  const dprRef = useRef(1);
  const runningRef = useRef(false);

  const buildGrid = useCallback((w: number, h: number) => {
    const cols = Math.ceil(w / CELL) + 1;
    const rows = Math.ceil(h / CELL) + 1;
    const grid: { char: string; x: number; y: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        grid.push({
          char: CHARS[Math.floor(Math.random() * CHARS.length)],
          x: c * CELL + CELL / 2,
          y: r * CELL + CELL / 2,
        });
      }
    }
    gridRef.current = grid;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const section = canvas.closest("section");

    function draw() {
      if (!canvas || !runningRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = dprRef.current;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.font = `${FONT_SIZE}px "Inter", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const r2 = HOVER_RADIUS * HOVER_RADIUS;

      const fadeTop = h * 0.05;
      const fadeBottom = h * 0.35;
      const fadeSide = w * 0.08;

      for (let i = 0; i < gridRef.current.length; i++) {
        const { char, x, y } = gridRef.current[i];
        if (x < -CELL || x > w + CELL || y < -CELL || y > h + CELL) continue;

        let edge = 1;
        if (y < fadeTop) edge *= y / fadeTop;
        if (y > h - fadeBottom) edge *= (h - y) / fadeBottom;
        if (x < fadeSide) edge *= x / fadeSide;
        if (x > w - fadeSide) edge *= (w - x) / fadeSide;
        edge = Math.max(0, Math.min(1, edge));

        const dx = x - mx;
        const dy = y - my;
        const dist2 = dx * dx + dy * dy;

        if (dist2 < r2) {
          const t = 1 - Math.sqrt(dist2) / HOVER_RADIUS;
          const eased = t * t;
          const alpha = (BASE_ALPHA + (HOVER_ALPHA - BASE_ALPHA) * eased) * edge;

          const rC = Math.round(255 - (255 - 94) * eased * 0.5);
          const gC = Math.round(255 - (255 - 234) * eased * 0.3);
          const bC = Math.round(255 - (255 - 212) * eased * 0.2);
          ctx.fillStyle = `rgba(${rC},${gC},${bC},${alpha})`;
        } else {
          ctx.fillStyle = `rgba(255,255,255,${BASE_ALPHA * edge})`;
        }

        if (edge > 0.01) ctx.fillText(char, x, y);
      }

      ctx.restore();
      if (runningRef.current) {
        rafRef.current = requestAnimationFrame(draw);
      }
    }

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      dprRef.current = dpr;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      buildGrid(rect.width, rect.height);
    };

    const handleMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const handleLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    resize();
    runningRef.current = true;
    rafRef.current = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    const target = section || canvas;
    target.addEventListener("mousemove", handleMove as EventListener);
    target.addEventListener("mouseleave", handleLeave);

    return () => {
      runningRef.current = false;
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      target.removeEventListener("mousemove", handleMove as EventListener);
      target.removeEventListener("mouseleave", handleLeave);
    };
  }, [buildGrid]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
