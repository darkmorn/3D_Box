import { useCallback, useEffect, useRef, useState } from 'react';

const SIZES = [2, 4, 7, 11];
const COLORS = ['#ff4d4f', '#f5c542', '#52c41a', '#2b82ff', '#6ec8ff', '#ffffff', '#1a1a1a'];

const TOOLS = [
  { id: 'select', title: '移动模型' },
  { id: 'pen', title: '自由画笔' },
  { id: 'curve', title: '平滑曲线' },
  { id: 'line', title: '直线' },
  { id: 'ellipse', title: '椭圆' },
  { id: 'rect', title: '矩形' },
  { id: 'text', title: '文字' },
  { id: 'eraser', title: '橡皮' },
];

function ToolIcon({ id }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  if (id === 'select') {
    return (
      <svg {...common}>
        <path d="M5 4 14 13.2l-2.4.4 2.2 5.2-2.1.9-2.2-5.1L5 17.5z" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === 'pen') {
    return (
      <svg {...common}>
        <path d="M4 16c2-6 5-9 9-9M13 7l4 4M8 18l-3 1 1-3 9-9 2 2z" />
        <circle cx="7" cy="17" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="16" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (id === 'curve') {
    return (
      <svg {...common}>
        <path d="M4 17c3-9 6-11 10-9 3 1.5 4 6 6 8" />
      </svg>
    );
  }
  if (id === 'line') {
    return (
      <svg {...common}>
        <path d="M5 18 19 6" />
        <path d="M15 6h4v4" />
      </svg>
    );
  }
  if (id === 'ellipse') {
    return (
      <svg {...common}>
        <ellipse cx="12" cy="12" rx="8" ry="5.5" />
      </svg>
    );
  }
  if (id === 'rect') {
    return (
      <svg {...common}>
        <rect x="5" y="6" width="14" height="12" rx="1.5" />
      </svg>
    );
  }
  if (id === 'text') {
    return (
      <svg {...common}>
        <path d="M6 6h12M12 6v12M9 18h6" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M5 15c3-1 5-5 7-5s3 5 7 5" />
      <path d="M7 19h10" />
    </svg>
  );
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function resampleScreen(points, count) {
  if (points.length < 2) return points.slice();
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  if (total < 1e-3) return [points[0], points[points.length - 1]];
  const out = [points[0]];
  const step = total / (count - 1);
  let traveled = 0;
  let seg = 0;
  let acc = 0;
  for (let i = 1; i < count - 1; i++) {
    const target = step * i;
    while (seg < points.length - 1 && acc + dist(points[seg], points[seg + 1]) < target) {
      acc += dist(points[seg], points[seg + 1]);
      seg += 1;
    }
    const a = points[seg];
    const b = points[Math.min(seg + 1, points.length - 1)];
    const segLen = dist(a, b) || 1;
    const t = (target - acc) / segLen;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  out.push(points[points.length - 1]);
  return out;
}

function shapePoints(tool, start, end, n = 48) {
  if (!start || !end) return [];
  if (tool === 'line') return [start, end];
  if (tool === 'rect') {
    return [
      { x: start.x, y: start.y },
      { x: end.x, y: start.y },
      { x: end.x, y: end.y },
      { x: start.x, y: end.y },
      { x: start.x, y: start.y },
    ];
  }
  if (tool === 'ellipse') {
    const cx = (start.x + end.x) / 2;
    const cy = (start.y + end.y) / 2;
    const rx = Math.abs(end.x - start.x) / 2;
    const ry = Math.abs(end.y - start.y) / 2;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI * 2 * i) / n;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
    }
    return pts;
  }
  return [];
}

function smoothPoints(points, iterations = 2) {
  let pts = points.slice();
  for (let k = 0; k < iterations; k++) {
    if (pts.length < 3) break;
    const next = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      next.push({
        x: pts[i - 1].x * 0.25 + pts[i].x * 0.5 + pts[i + 1].x * 0.25,
        y: pts[i - 1].y * 0.25 + pts[i].y * 0.5 + pts[i + 1].y * 0.25,
      });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export default function DrawTrajectory({ active, onCancel, onConfirm, onToolChange }) {
  const canvasRef = useRef(null);
  const strokesRef = useRef([]);
  const draftRef = useRef(null);
  const drawingRef = useRef(false);
  const startRef = useRef(null);

  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [strokeCount, setStrokeCount] = useState(0);

  const chooseTool = (next) => {
    setTool(next);
    onToolChange?.(next);
  };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const paint = (stroke) => {
      if (!stroke?.points?.length) return;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.beginPath();
      stroke.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    };

    strokesRef.current.forEach(paint);
    if (draftRef.current) paint(draftRef.current);
  }, []);

  useEffect(() => {
    if (!active) {
      strokesRef.current = [];
      draftRef.current = null;
      setStrokeCount(0);
      setTool('pen');
      onToolChange?.('pen');
      return undefined;
    }
    onToolChange?.(tool);
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ro = new ResizeObserver(() => redraw());
    ro.observe(canvas);
    redraw();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, redraw]);

  const localPoint = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e) => {
    if (!active || tool === 'text' || tool === 'select') return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const p = localPoint(e);
    startRef.current = p;

    if (tool === 'eraser') {
      const hit = [...strokesRef.current].reverse().findIndex((s) =>
        s.points.some((q) => dist(q, p) < Math.max(14, s.size * 2)),
      );
      if (hit >= 0) {
        strokesRef.current.splice(strokesRef.current.length - 1 - hit, 1);
        setStrokeCount(strokesRef.current.length);
        redraw();
      }
      drawingRef.current = false;
      return;
    }

    draftRef.current = {
      tool,
      color,
      size,
      points: [p],
    };
    redraw();
  };

  const onPointerMove = (e) => {
    if (!drawingRef.current || !draftRef.current) return;
    const p = localPoint(e);
    const draft = draftRef.current;
    if (draft.tool === 'pen' || draft.tool === 'curve') {
      const last = draft.points[draft.points.length - 1];
      if (dist(last, p) < 1.5) return;
      draft.points.push(p);
    } else {
      draft.points = shapePoints(draft.tool, startRef.current, p);
    }
    redraw();
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft || draft.points.length < 2) {
      redraw();
      return;
    }
    if (draft.tool === 'curve') {
      draft.points = smoothPoints(draft.points, 3);
    }
    strokesRef.current.push(draft);
    setStrokeCount(strokesRef.current.length);
    redraw();
  };

  const handleCancel = () => {
    strokesRef.current = [];
    draftRef.current = null;
    setStrokeCount(0);
    onCancel?.();
  };

  const handleConfirm = () => {
    const strokes = strokesRef.current;
    if (!strokes.length) {
      onCancel?.();
      return;
    }
    // Prefer the longest stroke as the main trajectory.
    const main = strokes.reduce((a, b) => (a.points.length >= b.points.length ? a : b));
    let points = main.points;
    if (main.tool === 'curve' || main.tool === 'pen') points = smoothPoints(points, 1);
    points = resampleScreen(points, Math.min(48, Math.max(8, Math.floor(points.length / 3))));
    onConfirm?.({
      points,
      color: main.color,
      size: main.size,
      strokes: strokes.map((s) => ({ ...s, points: s.points.slice() })),
    });
  };

  if (!active) return null;

  const selecting = tool === 'select';

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`draw-overlay ${selecting ? 'is-passthrough' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div className="draw-dock" role="toolbar" aria-label="绘制运镜轨迹">
        {!selecting && (
          <div className="draw-props">
            <div className="draw-sizes">
              {SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`draw-size ${size === s ? 'active' : ''}`}
                  title={`线宽 ${s}`}
                  onClick={() => setSize(s)}
                >
                  <span style={{ width: s + 2, height: s + 2 }} />
                </button>
              ))}
            </div>
            <div className="draw-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`draw-color ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  title={c}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="draw-tools-row">
          <button type="button" className="draw-action cancel" title="取消" onClick={handleCancel}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>

          <div className="draw-tools">
            <div className="draw-tool-group">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`draw-tool ${tool === t.id ? 'active' : ''}`}
                  title={t.title}
                  disabled={t.id === 'text'}
                  onClick={() => chooseTool(t.id)}
                >
                  <ToolIcon id={t.id} />
                </button>
              ))}
            </div>

            <button
              type="button"
              className="draw-action confirm"
              title="完成并生成轨迹"
              disabled={!strokeCount}
              onClick={handleConfirm}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12.5 10 17.5 19 7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
