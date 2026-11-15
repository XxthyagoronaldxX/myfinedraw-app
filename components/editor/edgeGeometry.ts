import { InternalNode, Position, XYPosition } from '@xyflow/react';

/**
 * Geometria das linhas livres (estilo Lucidchart).
 *
 * Âncora: ponto relativo na borda do bloco ({x,y} entre 0 e 1). Fica salvo na linha,
 * então ela acompanha o bloco ao mover/redimensionar.
 */
export type Anchor = { x: number; y: number };
export type LineType = 'smoothstep' | 'straight' | 'default';
export type MarkerKind = 'none' | 'arrow' | 'open' | 'circle' | 'diamond';
export type Dash = 'solid' | 'dashed' | 'dotted';

export interface FlexEdgeData {
  lineType?: LineType;
  points?: XYPosition[];
  sourceAnchor?: Anchor;
  targetAnchor?: Anchor;
  centerX?: number;
  centerY?: number;
  color?: string;
  width?: number;
  dash?: Dash;
  startMarker?: MarkerKind;
  endMarker?: MarkerKind;
  cardinality?: string;
  [k: string]: unknown;
}

export interface EndPoint extends XYPosition {
  pos: Position;
}

const DIR: Record<Position, XYPosition> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

export const sideOf = (a: Anchor): Position =>
  a.x <= 0 ? Position.Left : a.x >= 1 ? Position.Right : a.y <= 0 ? Position.Top : Position.Bottom;

/** Id do handle lateral mais próximo da âncora (os blocos têm handles t/r/b/l). */
export const handleFor = (a: Anchor) => ({ [Position.Left]: 'l', [Position.Right]: 'r', [Position.Top]: 't', [Position.Bottom]: 'b' })[sideOf(a)];

export const nodeRect = (n: InternalNode) => ({
  x: n.internals.positionAbsolute.x,
  y: n.internals.positionAbsolute.y,
  w: n.measured?.width ?? n.width ?? 0,
  h: n.measured?.height ?? n.height ?? 0,
});

/** Projeta um ponto (coordenadas do fluxo) na borda mais próxima do bloco. */
export function projectAnchor(n: InternalNode, p: XYPosition): Anchor {
  const r = nodeRect(n);
  if (!r.w || !r.h) return { x: 0.5, y: 1 };
  let x = Math.min(1, Math.max(0, (p.x - r.x) / r.w));
  let y = Math.min(1, Math.max(0, (p.y - r.y) / r.h));
  // borda mais próxima (em pixels, para blocos não quadrados)
  const d = { l: x * r.w, r: (1 - x) * r.w, t: y * r.h, b: (1 - y) * r.h };
  const min = Math.min(d.l, d.r, d.t, d.b);
  if (min === d.l) x = 0;
  else if (min === d.r) x = 1;
  else if (min === d.t) y = 0;
  else y = 1;
  // ímã leve no meio de cada lado
  if (x > 0 && x < 1 && Math.abs(x - 0.5) * r.w < 8) x = 0.5;
  if (y > 0 && y < 1 && Math.abs(y - 0.5) * r.h < 8) y = 0.5;
  return { x: +x.toFixed(4), y: +y.toFixed(4) };
}

export function anchorPoint(n: InternalNode, a: Anchor): EndPoint {
  const r = nodeRect(n);
  return { x: r.x + a.x * r.w, y: r.y + a.y * r.h, pos: sideOf(a) };
}

/** Lado por onde a linha sai de `from` em direção a `to` (ponta "solta", sendo arrastada). */
export function facing(from: XYPosition, to: XYPosition): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? Position.Right : Position.Left) : dy > 0 ? Position.Bottom : Position.Top;
}

const add = (a: XYPosition, b: XYPosition, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k });
const fmt = (p: XYPosition) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;

function dedupe(pts: XYPosition[]) {
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.01 || Math.abs(p.y - pts[i - 1].y) > 0.01);
}

const isH = (p: Position) => p === Position.Left || p === Position.Right;
const STUB = 20;

/**
 * Cantos do traçado ortogonal automático (sem s e t).
 * Os trechos alternam horizontal/vertical, começando pela direção de saída da origem.
 */
export function autoOrtho(s: EndPoint, t: EndPoint, centerX?: number, centerY?: number): XYPosition[] {
  const s1 = add(s, DIR[s.pos], STUB);
  const t1 = add(t, DIR[t.pos], STUB);
  const sh = isH(s.pos);
  const th = isH(t.pos);

  if (sh && th) {
    if (s.pos === t.pos) {
      const x = s.pos === Position.Right ? Math.max(s1.x, t1.x) : Math.min(s1.x, t1.x);
      return [{ x, y: s.y }, { x, y: t.y }];
    }
    const forward = s.pos === Position.Right ? s1.x <= t1.x : s1.x >= t1.x;
    if (forward) {
      const mx = centerX ?? (s1.x + t1.x) / 2;
      return [{ x: mx, y: s.y }, { x: mx, y: t.y }];
    }
    const my = centerY ?? (s.y + t.y) / 2;
    return [{ x: s1.x, y: s.y }, { x: s1.x, y: my }, { x: t1.x, y: my }, { x: t1.x, y: t.y }];
  }

  if (!sh && !th) {
    if (s.pos === t.pos) {
      const y = s.pos === Position.Bottom ? Math.max(s1.y, t1.y) : Math.min(s1.y, t1.y);
      return [{ x: s.x, y }, { x: t.x, y }];
    }
    const forward = s.pos === Position.Bottom ? s1.y <= t1.y : s1.y >= t1.y;
    if (forward) {
      const my = centerY ?? (s1.y + t1.y) / 2;
      return [{ x: s.x, y: my }, { x: t.x, y: my }];
    }
    const mx = centerX ?? (s.x + t.x) / 2;
    return [{ x: s.x, y: s1.y }, { x: mx, y: s1.y }, { x: mx, y: t1.y }, { x: t.x, y: t1.y }];
  }

  if (sh) {
    // sai na horizontal, entra na vertical: um canto basta quando os dois lados "se enxergam"
    const corner = { x: t.x, y: s.y };
    const okS = s.pos === Position.Right ? corner.x >= s1.x : corner.x <= s1.x;
    const okT = t.pos === Position.Top ? corner.y <= t1.y : corner.y >= t1.y;
    if (okS && okT) return [corner];
    return [{ x: s1.x, y: s.y }, { x: s1.x, y: t1.y }, { x: t.x, y: t1.y }];
  }
  const corner = { x: s.x, y: t.y };
  const okS = s.pos === Position.Bottom ? corner.y >= s1.y : corner.y <= s1.y;
  const okT = t.pos === Position.Left ? corner.x <= t1.x : corner.x >= t1.x;
  if (okS && okT) return [corner];
  return [{ x: s.x, y: s1.y }, { x: t1.x, y: s1.y }, { x: t1.x, y: t.y }];
}

/**
 * Reencaixa cantos salvos nas pontas atuais (os blocos podem ter se movido).
 * Devolve null se a quantidade de cantos não combina mais com os lados de saída/entrada.
 */
export function normalizeOrtho(s: EndPoint, t: EndPoint, pts: XYPosition[]): XYPosition[] | null {
  if (!pts.length) return null;
  const sh = isH(s.pos);
  const th = isH(t.pos);
  // trechos alternam H/V: mesma orientação nas pontas => nº de cantos par
  if ((pts.length % 2 === 0) !== (sh === th)) return null;
  const out = pts.map((p) => ({ ...p }));
  if (sh) out[0].y = s.y;
  else out[0].x = s.x;
  const last = out[out.length - 1];
  if (th) last.y = t.y;
  else last.x = t.x;
  return out;
}

/** Remove pontos repetidos e cantos "falsos" (três pontos alinhados). */
function simplify(route: XYPosition[]) {
  const pts = dedupe(route);
  return pts.filter((p, i) => {
    if (i === 0 || i === pts.length - 1) return true;
    const a = pts[i - 1];
    const b = pts[i + 1];
    return !((Math.abs(a.x - p.x) < 0.5 && Math.abs(p.x - b.x) < 0.5) || (Math.abs(a.y - p.y) < 0.5 && Math.abs(p.y - b.y) < 0.5));
  });
}

/** Polilinha com cantos arredondados. */
function roundedPath(route: XYPosition[], radius = 8) {
  let d = `M${fmt(route[0])}`;
  for (let i = 1; i < route.length - 1; i++) {
    const [a, b, c] = [route[i - 1], route[i], route[i + 1]];
    const r = Math.min(radius, Math.hypot(b.x - a.x, b.y - a.y) / 2, Math.hypot(c.x - b.x, c.y - b.y) / 2);
    const inP = { x: b.x - Math.sign(b.x - a.x) * r, y: b.y - Math.sign(b.y - a.y) * r };
    const outP = { x: b.x + Math.sign(c.x - b.x) * r, y: b.y + Math.sign(c.y - b.y) * r };
    d += ` L${fmt(inP)} Q${fmt(b)} ${fmt(outP)}`;
  }
  return `${d} L${fmt(route[route.length - 1])}`;
}

/** Trechos Bézier da curva suave (Catmull-Rom) passando pelos pontos. */
function curveSegments(s: EndPoint, t: EndPoint, pts: XYPosition[]) {
  const all = [s, ...pts, t];
  const reach = Math.max(40, Math.hypot(t.x - s.x, t.y - s.y) / 3);
  const ext = [add(s, DIR[s.pos], -reach), ...all, add(t, DIR[t.pos], -reach)];
  const segs: { p0: XYPosition; c1: XYPosition; c2: XYPosition; p3: XYPosition }[] = [];
  for (let i = 1; i < ext.length - 2; i++) {
    const [p0, p1, p2, p3] = [ext[i - 1], ext[i], ext[i + 1], ext[i + 2]];
    segs.push({
      p0: p1,
      c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
      c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
      p3: p2,
    });
  }
  return segs;
}
const bezierMid = (g: { p0: XYPosition; c1: XYPosition; c2: XYPosition; p3: XYPosition }) => ({
  x: (g.p0.x + 3 * g.c1.x + 3 * g.c2.x + g.p3.x) / 8,
  y: (g.p0.y + 3 * g.c1.y + 3 * g.c2.y + g.p3.y) / 8,
});

const polyPath = (pts: XYPosition[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${fmt(p)}`).join(' ');

/** Ponto no meio do comprimento de uma polilinha (para o rótulo). */
export function polylineMid(pts: XYPosition[]): XYPosition {
  const segs = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let half = segs.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < segs.length; i++) {
    if (half <= segs[i] || i === segs.length - 1) {
      const k = segs[i] ? half / segs[i] : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k };
    }
    half -= segs[i];
  }
  return pts[0];
}

/** Trecho móvel de uma linha ortogonal: índices dos dois cantos (em `corners`) e orientação. */
export interface OrthoSegment {
  a: number;
  b: number;
  horizontal: boolean;
  mid: XYPosition;
}

export interface Route {
  path: string;
  label: XYPosition;
  /** ortogonal: cantos efetivos (salvos e reencaixados, ou automáticos) */
  corners: XYPosition[];
  /** ortogonal: trechos internos que podem ser arrastados (pílulas) */
  segments: OrthoSegment[];
  /** reta/curva: meio de cada trecho entre pontos (quadradinhos para criar dobra) */
  mids: XYPosition[];
}

export function buildRoute(lineType: LineType, s: EndPoint, t: EndPoint, pts: XYPosition[], center?: { x?: number; y?: number }): Route {
  if (lineType === 'straight') {
    const all = [s, ...pts, t];
    const mids = all.slice(1).map((b, i) => ({ x: (all[i].x + b.x) / 2, y: (all[i].y + b.y) / 2 }));
    return { path: polyPath(all), label: polylineMid(all), corners: [], segments: [], mids };
  }
  if (lineType === 'default') {
    const segs = curveSegments(s, t, pts);
    const d = segs.reduce((acc, g) => `${acc} C${fmt(g.c1)} ${fmt(g.c2)} ${fmt(g.p3)}`, `M${fmt(s)}`);
    const mids = segs.map(bezierMid);
    return { path: d, label: mids[Math.floor(mids.length / 2)] ?? s, corners: [], segments: [], mids };
  }

  const corners = normalizeOrtho(s, t, pts) ?? autoOrtho(s, t, center?.x, center?.y);
  const route = simplify([s, ...corners, t]);
  // trechos internos (sem tocar as pontas) ganham pílula
  const all = [s, ...corners, t];
  const segments: OrthoSegment[] = [];
  for (let i = 1; i < all.length - 2; i++) {
    const a = all[i];
    const b = all[i + 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) < 12) continue;
    segments.push({ a: i - 1, b: i, horizontal: Math.abs(a.y - b.y) < 0.5, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }
  return { path: roundedPath(route), label: polylineMid(route), corners, segments, mids: [] };
}

/** Índice em `points` onde inserir um ponto novo perto de `p` (trecho mais próximo de [s, ...points, t]). */
export function insertIndex(s: XYPosition, t: XYPosition, points: XYPosition[], p: XYPosition) {
  const all = [s, ...points, t];
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i];
    const b = all[i + 1];
    const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
    const d = Math.hypot(p.x - (a.x + (b.x - a.x) * k), p.y - (a.y + (b.y - a.y) * k));
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
