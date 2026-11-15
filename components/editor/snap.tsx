'use client';

import { Node, NodePositionChange, useStore } from '@xyflow/react';

/**
 * Snap de alinhamento (estilo Lucidchart): ao arrastar um bloco, suas bordas e
 * centro "grudam" nas bordas/centros dos outros blocos próximos.
 *
 * Guias desenhadas (coordenadas do fluxo):
 * - centralizado e com o mesmo tamanho → linhas tracejadas prolongando os dois lados
 *   pelo vão entre os blocos + seta com a distância;
 * - centralizado com tamanho diferente → linha tracejada no eixo central + distância;
 * - alinhado por uma borda → linha tracejada só no trecho entre os dois blocos.
 */

export interface GuideLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface GuideMeasure extends GuideLine {
  label: string;
}
export interface Guides {
  lines?: GuideLine[];
  measures?: GuideMeasure[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rectOf = (n: Node, pos = n.position): Rect => ({
  x: pos.x,
  y: pos.y,
  w: n.measured?.width ?? n.width ?? 0,
  h: n.measured?.height ?? n.height ?? 0,
});

/** Âncoras: 0 = início (esquerda/topo), 1 = centro, 2 = fim (direita/base). */
const anchors = (start: number, size: number) => [start, start + size / 2, start + size];

type Match = { dist: number; delta: number; at: number; other?: Rect; mine: number; theirs: number };

const SAME_SIZE_TOLERANCE = 1;

/**
 * Espaçamento igual: procura, na mesma coluna (axis 'y') ou linha (axis 'x'), um par de
 * blocos cujo vão possa ser repetido pelo bloco arrastado — depois do par, antes dele, ou
 * centralizando entre dois blocos. Devolve a posição alvo e as setas dos dois vãos.
 */
function equalSpacing(r: Rect, others: Rect[], axis: 'x' | 'y', threshold: number) {
  const pos = (p: Rect) => (axis === 'y' ? p.y : p.x);
  const len = (p: Rect) => (axis === 'y' ? p.h : p.w);
  const end = (p: Rect) => pos(p) + len(p);
  const cPos = (p: Rect) => (axis === 'y' ? p.x : p.y);
  const cEnd = (p: Rect) => cPos(p) + (axis === 'y' ? p.w : p.h);
  const overlaps = (p: Rect, q: Rect) => cPos(p) < cEnd(q) && cPos(q) < cEnd(p);
  const crossMid = (p: Rect, q: Rect) => (Math.max(cPos(p), cPos(q)) + Math.min(cEnd(p), cEnd(q))) / 2;
  const at = (p: Rect, v: number): Rect => (axis === 'y' ? { ...p, y: v } : { ...p, x: v });
  const seg = (a: number, b: number, c: number, label: string): GuideMeasure =>
    axis === 'y' ? { x1: c, y1: a, x2: c, y2: b, label } : { x1: a, y1: c, x2: b, y2: c, label };

  const current = pos(r);
  let best: { target: number; dist: number; measures: GuideMeasure[] } | null = null;
  const consider = (target: number, gap: number, build: (moved: Rect, label: string) => GuideMeasure[]) => {
    if (gap < 1) return;
    const dist = Math.abs(target - current);
    if (dist >= threshold || (best && dist >= best.dist)) return;
    best = { target, dist, measures: build(at(r, target), `${Math.round(gap)} px`) };
  };

  const column = others.filter((o) => overlaps(o, r));
  for (const a of column) {
    for (const b of others) {
      if (b === a || !overlaps(a, b)) continue;
      // B, A, [arrastado]: repete o vão B→A depois de A
      if (end(b) <= pos(a)) {
        const gap = pos(a) - end(b);
        consider(end(a) + gap, gap, (m, label) => [seg(end(b), pos(a), crossMid(a, b), label), seg(end(a), pos(m), crossMid(a, m), label)]);
      }
      // [arrastado], A, B: repete o vão A→B antes de A
      if (pos(b) >= end(a)) {
        const gap = pos(b) - end(a);
        consider(pos(a) - gap - len(r), gap, (m, label) => [seg(end(m), pos(a), crossMid(a, m), label), seg(end(a), pos(b), crossMid(a, b), label)]);
      }
    }
    // A, [arrastado], B: centraliza entre dois blocos da mesma coluna
    for (const b of column) {
      if (b === a || end(a) > pos(b)) continue;
      const gap = (pos(b) - end(a) - len(r)) / 2;
      consider(end(a) + gap, gap, (m, label) => [seg(end(a), pos(m), crossMid(a, m), label), seg(end(m), pos(b), crossMid(m, b), label)]);
    }
  }
  return best as { target: number; dist: number; measures: GuideMeasure[] } | null;
}

/** Ajusta a posição do bloco arrastado e devolve as guias a desenhar. */
export function snapToNodes(change: NodePositionChange, nodes: Node[], threshold: number): Guides {
  const me = nodes.find((n) => n.id === change.id);
  if (!me || !change.position || me.parentId) return {};
  const start = rectOf(me, change.position);
  if (!start.w || !start.h) return {};

  const mineX = anchors(start.x, start.w);
  const mineY = anchors(start.y, start.h);
  let bestX: Match = { dist: threshold, delta: 0, at: 0, mine: -1, theirs: -1 };
  let bestY: Match = { dist: threshold, delta: 0, at: 0, mine: -1, theirs: -1 };

  const others: Rect[] = [];
  for (const other of nodes) {
    if (other.id === me.id || other.parentId || other.selected) continue;
    const o = rectOf(other);
    if (!o.w || !o.h) continue;
    others.push(o);
    const ox = anchors(o.x, o.w);
    const oy = anchors(o.y, o.h);
    mineX.forEach((a, i) =>
      ox.forEach((b, j) => {
        const d = Math.abs(a - b);
        // em empate, prefere centro↔centro (é o alinhamento mais "intencional")
        if (d < bestX.dist || (d === bestX.dist && i === 1 && j === 1)) bestX = { dist: d, delta: b - a, at: b, other: o, mine: i, theirs: j };
      }),
    );
    mineY.forEach((a, i) =>
      oy.forEach((b, j) => {
        const d = Math.abs(a - b);
        if (d < bestY.dist || (d === bestY.dist && i === 1 && j === 1)) bestY = { dist: d, delta: b - a, at: b, other: o, mine: i, theirs: j };
      }),
    );
  }

  // ---- espaçamento igual (tem prioridade quando estiver tão perto quanto o alinhamento)
  const snappedX = bestX.other ? start.x + bestX.delta : start.x;
  const spacingY = equalSpacing({ ...start, x: snappedX }, others, 'y', threshold);
  const useSpacingY = !!spacingY && (!bestY.other || spacingY.dist <= bestY.dist);
  const finalY = useSpacingY ? spacingY!.target : bestY.other ? start.y + bestY.delta : start.y;
  const spacingX = equalSpacing({ ...start, y: finalY }, others, 'x', threshold);
  const useSpacingX = !!spacingX && (!bestX.other || spacingX.dist <= bestX.dist);
  if (useSpacingX) bestX = { ...bestX, other: undefined };
  if (useSpacingY) bestY = { ...bestY, other: undefined };

  change.position.x = useSpacingX ? spacingX!.target : snappedX;
  change.position.y = finalY;
  const r: Rect = { ...start, x: change.position.x, y: change.position.y };

  const lines: GuideLine[] = [];
  const measures: GuideMeasure[] = [];
  if (useSpacingY) measures.push(...spacingY!.measures);
  if (useSpacingX) measures.push(...spacingX!.measures);

  // ---- alinhamento no eixo X (blocos um acima do outro)
  if (bestX.other) {
    const o = bestX.other;
    const top = Math.min(r.y, o.y);
    const bottom = Math.max(r.y + r.h, o.y + o.h);
    const gap = r.y >= o.y + o.h ? [o.y + o.h, r.y] : o.y >= r.y + r.h ? [r.y + r.h, o.y] : null;
    const centered = bestX.mine === 1 && bestX.theirs === 1;
    const sameWidth = Math.abs(r.w - o.w) <= SAME_SIZE_TOLERANCE;

    if (centered && gap) {
      // se o espaçamento igual já mede este vão, não repete a seta
      if (!useSpacingY) measures.push({ x1: bestX.at, y1: gap[0], x2: bestX.at, y2: gap[1], label: `${Math.round(gap[1] - gap[0])} px` });
      if (sameWidth) {
        lines.push({ x1: r.x, y1: gap[0], x2: r.x, y2: gap[1] }, { x1: r.x + r.w, y1: gap[0], x2: r.x + r.w, y2: gap[1] });
      } else {
        lines.push({ x1: bestX.at, y1: top, x2: bestX.at, y2: bottom });
      }
    } else {
      lines.push({ x1: bestX.at, y1: top, x2: bestX.at, y2: bottom });
    }
  }

  // ---- alinhamento no eixo Y (blocos lado a lado)
  if (bestY.other) {
    const o = bestY.other;
    const left = Math.min(r.x, o.x);
    const right = Math.max(r.x + r.w, o.x + o.w);
    const gap = r.x >= o.x + o.w ? [o.x + o.w, r.x] : o.x >= r.x + r.w ? [r.x + r.w, o.x] : null;
    const centered = bestY.mine === 1 && bestY.theirs === 1;
    const sameHeight = Math.abs(r.h - o.h) <= SAME_SIZE_TOLERANCE;

    if (centered && gap) {
      if (!useSpacingX) measures.push({ x1: gap[0], y1: bestY.at, x2: gap[1], y2: bestY.at, label: `${Math.round(gap[1] - gap[0])} px` });
      if (sameHeight) {
        lines.push({ x1: gap[0], y1: r.y, x2: gap[1], y2: r.y }, { x1: gap[0], y1: r.y + r.h, x2: gap[1], y2: r.y + r.h });
      } else {
        lines.push({ x1: left, y1: bestY.at, x2: right, y2: bestY.at });
      }
    } else {
      lines.push({ x1: left, y1: bestY.at, x2: right, y2: bestY.at });
    }
  }

  return lines.length || measures.length ? { lines, measures } : {};
}

/** Desenha as guias por cima do canvas, convertendo coordenadas do fluxo para a tela. */
export function GuideLines({ guides }: { guides: Guides }) {
  const [tx, ty, zoom] = useStore((s) => s.transform);
  if (!guides.lines?.length && !guides.measures?.length) return null;
  const sx = (x: number) => x * zoom + tx;
  const sy = (y: number) => y * zoom + ty;
  const color = 'var(--mfd-brand)';

  return (
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-hidden">
      <defs>
        <marker id="mfd-measure-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M1,1 L9,5 L1,9" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {guides.lines?.map((l, i) => (
        <line key={`l${i}`} x1={sx(l.x1)} y1={sy(l.y1)} x2={sx(l.x2)} y2={sy(l.y2)} stroke={color} strokeWidth={1} strokeDasharray="4 3" />
      ))}

      {guides.measures?.map((m, i) => {
        const x1 = sx(m.x1);
        const y1 = sy(m.y1);
        const x2 = sx(m.x2);
        const y2 = sy(m.y2);
        const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1);
        const length = vertical ? Math.abs(y2 - y1) : Math.abs(x2 - x1);
        const cx = (x1 + x2) / 2;
        const cy = (y1 + y2) / 2;
        const labelW = m.label.length * 6.6 + 10;
        // em vãos curtos a etiqueta vai para o lado, para não cobrir a seta
        const outside = length < 34;
        const lx = vertical && outside ? cx + labelW / 2 + 6 : cx;
        const ly = !vertical && outside ? cy - 14 : cy;
        return (
          <g key={`m${i}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.25} markerStart="url(#mfd-measure-arrow)" markerEnd="url(#mfd-measure-arrow)" />
            <rect x={lx - labelW / 2} y={ly - 9} width={labelW} height={18} rx={4} fill="var(--mfd-surface)" stroke={color} strokeWidth={0.75} />
            <text x={lx} y={ly + 4} textAnchor="middle" fontSize={11} fontFamily="var(--font-code), monospace" fill={color}>
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
