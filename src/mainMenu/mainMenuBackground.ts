interface PolyPoint {
  x: number; y: number;
  vx: number; vy: number;
  ox: number; oy: number;
}

interface Triangle {
  a: number; b: number; c: number;
  color: string;
}

const POLY_COLORS: string[] = [
  '#56989eff', '#599fa6', '#5ea9b0ff',
];

export function initMainMenuBackground(): void {
  const canvas = document.getElementById('bg-canvas') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;

  let W: number, H: number;
  let points: PolyPoint[] = [];
  let triangles: Triangle[] = [];

  function resize(): void {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    buildMesh();
  }

  function buildMesh(): void {
    const cols = 9;
    const rows = 5;
    const cellW = W / (cols - 1);
    const cellH = H / (rows - 1);
    points = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const edge = r === 0 || r === rows - 1 || c === 0 || c === cols - 1;
        const jx = edge ? 0 : (Math.random() - 0.5) * cellW * 0.75;
        const jy = edge ? 0 : (Math.random() - 0.5) * cellH * 0.75;
        const ox = c * cellW + jx;
        const oy = r * cellH + jy;
        points.push({ x: ox, y: oy, vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5, ox, oy });
      }
    }

    triangles = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i = r * cols + c;
        triangles.push({ a: i, b: i + 1, c: i + cols, color: POLY_COLORS[Math.floor(Math.random() * POLY_COLORS.length)] });
        triangles.push({ a: i + 1, b: i + cols + 1, c: i + cols, color: POLY_COLORS[Math.floor(Math.random() * POLY_COLORS.length)] });
      }
    }
  }

  function tick(): void {
    ctx.clearRect(0, 0, W, H);
    for (const p of points) {
      p.vx += (p.ox - p.x) * 0.0004;
      p.vy += (p.oy - p.y) * 0.0004;
      p.vx *= 0.992;
      p.vy *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
    }
    for (const t of triangles) {
      const a = points[t.a], b = points[t.b], c = points[t.c];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.closePath();
      ctx.fillStyle = t.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  resize();
  tick();
}