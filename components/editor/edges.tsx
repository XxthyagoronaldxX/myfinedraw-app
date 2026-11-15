'use client';

import { BaseEdge, EdgeLabelRenderer, EdgeProps, useInternalNode, useReactFlow, useStore, XYPosition } from '@xyflow/react';
import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  anchorPoint,
  buildRoute,
  Dash,
  EndPoint,
  facing,
  FlexEdgeData,
  handleFor,
  insertIndex,
  LineType,
  MarkerKind,
  OrthoSegment,
  projectAnchor,
} from './edgeGeometry';
import * as I from './icons';
import { useBoard } from './store';

/** Marcadores pé de galinha usados pelos relacionamentos ER. */
export function ErMarkers() {
  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker id="er-one" viewBox="0 0 20 20" markerWidth="20" markerHeight="20" refX="18" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M8,3 V17 M13,3 V17" stroke="var(--mfd-ink-soft)" strokeWidth="1.5" fill="none" />
        </marker>
        <marker id="er-many" viewBox="0 0 20 20" markerWidth="20" markerHeight="20" refX="18" refY="10" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
          <path d="M6,10 L18,3 M6,10 L18,10 M6,10 L18,17 M4,3 V17" stroke="var(--mfd-ink-soft)" strokeWidth="1.5" fill="none" />
        </marker>
      </defs>
    </svg>
  );
}

const DRAG_THRESHOLD = 3;
/** Alças da linha ficam acima dos blocos (as pontas ficam bem na borda deles). */
const GRIP_Z = 2000;
const DASHES = { solid: undefined, dashed: '7 5', dotted: '1 5' } as const;
const MARKER_CYCLE: MarkerKind[] = ['none', 'arrow', 'open', 'circle', 'diamond'];
const DASH_CYCLE: Dash[] = ['solid', 'dashed', 'dotted'];
const WIDTHS = [1, 1.5, 2.5, 4];

/** Ponta de seta desenhada na cor/espessura da própria linha. */
function Marker({ id, kind, color, width }: { id: string; kind: MarkerKind; color: string; width: number }) {
  if (kind === 'none') return null;
  const size = 8 + width * 2.5;
  const shape = {
    arrow: <path d="M0,0 L10,5 L0,10 Z" fill={color} />,
    open: <path d="M1,1 L9,5 L1,9" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />,
    circle: <circle cx="5" cy="5" r="4" fill={color} />,
    diamond: <path d="M0,5 L5,0 L10,5 L5,10 Z" fill={color} />,
  }[kind];
  return (
    <marker id={id} viewBox="0 0 10 10" markerWidth={size} markerHeight={size} refX={kind === 'circle' ? 8 : 9} refY="5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
      {shape}
    </marker>
  );
}

type ScreenPoint = { clientX: number; clientY: number };

/**
 * Arraste com captura do ponteiro; ignora tremidas abaixo de DRAG_THRESHOLD px.
 * Se o navegador perder a captura (ex.: elemento re-renderizado), o arraste é
 * finalizado na última posição conhecida — nunca fica "preso" ao mouse.
 */
function useDrag(handlers: {
  onStart?: (p: XYPosition) => void;
  onMove: (p: XYPosition, start: XYPosition) => void;
  onEnd?: (moved: boolean, at: ScreenPoint, p: XYPosition) => void;
}) {
  const rf = useReactFlow();
  const state = useRef<{ start: XYPosition; sx: number; sy: number; last: ScreenPoint; moved: boolean } | null>(null);
  const finish = (at: ScreenPoint) => {
    const g = state.current;
    state.current = null;
    if (g) handlers.onEnd?.(g.moved, at, rf.screenToFlowPosition({ x: at.clientX, y: at.clientY }));
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const start = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
      state.current = { start, sx: e.clientX, sy: e.clientY, last: { clientX: e.clientX, clientY: e.clientY }, moved: false };
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      handlers.onStart?.(start);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = state.current;
      if (!g) return;
      g.last = { clientX: e.clientX, clientY: e.clientY };
      if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_THRESHOLD) return;
      g.moved = true;
      handlers.onMove(rf.screenToFlowPosition({ x: e.clientX, y: e.clientY }), g.start);
    },
    onPointerUp: (e: React.PointerEvent) => {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      finish({ clientX: e.clientX, clientY: e.clientY });
    },
    onPointerCancel: (e: React.PointerEvent) => finish({ clientX: e.clientX, clientY: e.clientY }),
    onLostPointerCapture: () => {
      const g = state.current;
      if (g) finish(g.last);
    },
  };
}

const round = (p: XYPosition) => ({ x: Math.round(p.x), y: Math.round(p.y) });
const edgeData = (id: string) => (useBoard.getState().edges.find((e) => e.id === id)?.data ?? {}) as FlexEdgeData;

function selectOnly(id: string) {
  useBoard.setState((s) => ({
    nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    edges: s.edges.map((x) => (x.selected !== (x.id === id) ? { ...x, selected: x.id === id } : x)),
  }));
}

/** Distância de um ponto a um segmento. */
function distToSegment(p: XYPosition, a: XYPosition, b: XYPosition) {
  const len2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / len2));
  return Math.hypot(p.x - (a.x + (b.x - a.x) * k), p.y - (a.y + (b.y - a.y) * k));
}

/* ---------------- alças ---------------- */

const gripStyle = (p: XYPosition, extra: React.CSSProperties = {}): React.CSSProperties => ({
  transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
  pointerEvents: 'all',
  zIndex: GRIP_Z,
  ...extra,
});

/** Pílula no meio de um trecho ortogonal: arrastar move o trecho inteiro, mantendo os ângulos retos. */
function SegmentPill({ seg, drag }: { seg: OrthoSegment; drag: ReturnType<typeof useDrag> }) {
  return (
    <div
      {...drag}
      title="Arraste para mover este trecho"
      className="nodrag nopan absolute rounded-full border-2 border-brand bg-surface shadow-soft transition-colors hover:bg-brand"
      style={gripStyle(seg.mid, { width: seg.horizontal ? 22 : 9, height: seg.horizontal ? 9 : 22, cursor: seg.horizontal ? 'ns-resize' : 'ew-resize' })}
    />
  );
}

/* ---------------- barra flutuante ---------------- */

const markerGlyph = (k: MarkerKind, start: boolean) =>
  ({ none: '—', arrow: start ? '◀' : '▶', open: start ? '‹' : '›', circle: '●', diamond: '◆' })[k];
const dashGlyph = (d: Dash) => ({ solid: '———', dashed: '- - -', dotted: '· · ·' })[d];

function ToolbarButton({ title, active, onClick, children }: { title: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 font-mono text-[11px] transition ${active ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-surface-2'}`}
    >
      {children}
    </button>
  );
}

/** Barra de formatação que aparece sobre a linha selecionada (estilo Lucidchart). */
function LineToolbar({ id, at, d, lineType, color, width, startKind, endKind, swap }: {
  id: string;
  at: XYPosition;
  d: FlexEdgeData;
  lineType: LineType;
  color: string;
  width: number;
  startKind: MarkerKind;
  endKind: MarkerKind;
  swap: () => void;
}) {
  const zoom = useStore((s) => s.transform[2]);
  const set = (patch: Partial<FlexEdgeData>) => useBoard.getState().updateEdgeData(id, patch);
  const next = <T,>(list: T[], cur: T) => list[(list.indexOf(cur) + 1) % list.length];
  const wIndex = Math.max(0, WIDTHS.indexOf(width));
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    // âncora de tamanho zero: só a barra visível recebe cliques (antes a caixa invisível
    // da âncora ficava por cima das pontas da linha e "roubava" o clique)
    <div className="absolute h-0 w-0" style={{ transform: `translate(${at.x}px, ${at.y}px)`, pointerEvents: 'none', zIndex: GRIP_Z + 1 }}>
      {/* tamanho constante na tela, independente do zoom */}
      <div
        onPointerDown={stop}
        onDoubleClick={stop}
        className="nodrag nopan absolute left-0 top-0 flex w-max items-center gap-0.5 rounded-xl border border-line bg-surface p-1 shadow-soft"
        style={{ transform: `translate(-50%, calc(-100% - 22px)) scale(${1 / zoom})`, transformOrigin: '50% calc(100% + 22px)', pointerEvents: 'all' }}
      >
        <ToolbarButton title="Ortogonal" active={lineType === 'smoothstep'} onClick={() => set({ lineType: 'smoothstep', points: undefined })}>
          <I.EdgeStep />
        </ToolbarButton>
        <ToolbarButton title="Reta" active={lineType === 'straight'} onClick={() => set({ lineType: 'straight', points: undefined })}>
          <I.EdgeStraight />
        </ToolbarButton>
        <ToolbarButton title="Curva" active={lineType === 'default'} onClick={() => set({ lineType: 'default', points: undefined })}>
          <I.EdgeCurve />
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-line" />
        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-surface-2" title="Cor">
          <span className="h-4 w-4 rounded-full border border-line" style={{ background: color }} />
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#888888'}
            onChange={(e) => set({ color: e.target.value })}
          />
        </label>
        <ToolbarButton title="Mais fina" onClick={() => set({ width: WIDTHS[Math.max(0, wIndex - 1)] })}>
          <Minus className="h-3 w-3" />
        </ToolbarButton>
        <span className="w-7 text-center font-mono text-[11px] text-ink-soft">{width}px</span>
        <ToolbarButton title="Mais grossa" onClick={() => set({ width: WIDTHS[Math.min(WIDTHS.length - 1, wIndex + 1)] })}>
          <Plus className="h-3 w-3" />
        </ToolbarButton>
        <ToolbarButton title="Traço (clique para alternar)" onClick={() => set({ dash: next(DASH_CYCLE, d.dash ?? 'solid') })}>
          {dashGlyph(d.dash ?? 'solid')}
        </ToolbarButton>
        <span className="mx-0.5 h-5 w-px bg-line" />
        <ToolbarButton title="Ponta no início (clique para alternar)" onClick={() => set({ startMarker: next(MARKER_CYCLE, startKind) })}>
          {markerGlyph(startKind, true)}
        </ToolbarButton>
        <ToolbarButton title="Inverter direção" onClick={swap}>
          <ArrowLeftRight className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton title="Ponta no fim (clique para alternar)" onClick={() => set({ endMarker: next(MARKER_CYCLE, endKind) })}>
          {markerGlyph(endKind, false)}
        </ToolbarButton>
      </div>
    </div>
  );
}

/* ---------------- linha ---------------- */

function LineEdge(p: EdgeProps & { er: boolean }) {
  const { id, er, selected } = p;
  const d = (p.data ?? {}) as FlexEdgeData;
  const rf = useReactFlow();
  const sNode = useInternalNode(p.source);
  const tNode = useInternalNode(p.target);
  const [endDrag, setEndDrag] = useState<null | { which: 's' | 't'; p: XYPosition }>(null);
  // Esc durante o arraste de uma ponta cancela (a linha volta para onde estava)
  const endCancelled = useRef(false);
  useEffect(() => {
    if (!endDrag) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      endCancelled.current = true;
      setEndDrag(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [endDrag]);
  const points = d.points ?? [];

  const lineType: LineType = er ? 'smoothstep' : d.lineType ?? (p.type === 'straight' || p.type === 'default' ? p.type : 'smoothstep');

  // pontas: âncora livre na borda (fluxograma) ou o handle (colunas das tabelas ER)
  let s: EndPoint = !er && d.sourceAnchor && sNode ? anchorPoint(sNode, d.sourceAnchor) : { x: p.sourceX, y: p.sourceY, pos: p.sourcePosition };
  let t: EndPoint = !er && d.targetAnchor && tNode ? anchorPoint(tNode, d.targetAnchor) : { x: p.targetX, y: p.targetY, pos: p.targetPosition };
  if (endDrag?.which === 's') s = { ...endDrag.p, pos: facing(endDrag.p, t) };
  if (endDrag?.which === 't') t = { ...endDrag.p, pos: facing(endDrag.p, s) };

  // ao arrastar uma ponta, o traçado volta ao automático para acompanhar
  const route = buildRoute(lineType, s, t, endDrag ? [] : points, { x: d.centerX, y: d.centerY });

  // alças das pontas: área de clique de 26px na tela; em linhas curtas, encolhe para as duas não se sobreporem
  const zoom = useStore((st) => st.transform[2]);
  const endsDistance = Math.hypot(t.x - s.x, t.y - s.y) * zoom;
  const gripHit = Math.max(14, Math.min(26, endsDistance - 2));

  // barra flutuante: centralizada acima de toda a linha (não em cima dela)
  const box = [s, t, ...route.corners, ...points];
  const toolbarAt = {
    x: (Math.min(...box.map((b) => b.x)) + Math.max(...box.map((b) => b.x))) / 2,
    y: Math.min(...box.map((b) => b.y)),
  };

  // aparência
  const width = d.width ?? 1.5;
  const color = er ? (selected ? 'var(--mfd-brand)' : 'var(--mfd-ink-soft)') : d.color ?? (p.style?.stroke as string) ?? 'var(--mfd-ink-soft)';
  const startKind: MarkerKind = d.startMarker ?? 'none';
  const endKind: MarkerKind = d.endMarker ?? (p.type === 'flex' || p.markerEnd ? 'arrow' : 'none');
  const ms = `mfd-${id}-s`;
  const me = `mfd-${id}-e`;
  const [from, to] = String(d.cardinality ?? 'N:1').split(':');
  const erMarker = (side: string) => (side === 'N' ? 'url(#er-many)' : 'url(#er-one)');

  /* ----- ortogonal: mover um trecho inteiro ----- */
  const segRef = useRef<{ seg: OrthoSegment; corners: XYPosition[] } | null>(null);
  const moveSegment = (q: XYPosition) => {
    const g = segRef.current;
    if (!g) return;
    const corners = g.corners.map((c) => ({ ...c }));
    const axis = g.seg.horizontal ? 'y' : 'x';
    let v = Math.round(q[axis]);
    // trechos ligados às pontas não podem "voltar" para dentro do bloco: mantém um toco mínimo
    const MIN_STUB = 20;
    const clampFor = (end: EndPoint, outward: boolean) => {
      const dirAxis = end.pos === 'left' || end.pos === 'right' ? 'x' : 'y';
      if (dirAxis !== axis) return;
      const sign = end.pos === 'right' || end.pos === 'bottom' ? 1 : -1;
      const limit = end[axis] + sign * MIN_STUB;
      if (outward) v = sign > 0 ? Math.max(v, limit) : Math.min(v, limit);
    };
    if (g.seg.a === 0) clampFor(s, true);
    if (g.seg.b === corners.length - 1) clampFor(t, true);
    corners[g.seg.a][axis] = corners[g.seg.b][axis] = v;
    useBoard.getState().updateEdgeData(id, { points: corners, centerX: undefined, centerY: undefined });
  };
  /** Escolhe o trecho móvel mais próximo do ponto agarrado (até `maxDist` px na tela). */
  const grabSegment = (start: XYPosition, maxDist = Infinity) => {
    let best: OrthoSegment | null = null;
    let bestD = maxDist / rf.getZoom();
    for (const seg of route.segments) {
      const dd = distToSegment(start, route.corners[seg.a], route.corners[seg.b]);
      if (dd < bestD) {
        bestD = dd;
        best = seg;
      }
    }
    segRef.current = best ? { seg: best, corners: route.corners } : null;
  };
  // pílulas: o hook é um só; o trecho é o mais próximo de onde a pílula foi agarrada
  const pillDrag = useDrag({ onStart: (start) => grabSegment(start), onMove: moveSegment, onEnd: () => (segRef.current = null) });

  /* ----- reta/curva: criar e mover pontos ----- */
  // >= 0: índice do ponto sendo movido; < 0: ainda vai inserir em (-1 - valor)
  const pointIndex = useRef(-1);
  const startPointDrag = (start: XYPosition) => {
    const hit = points.findIndex((pt) => Math.hypot(pt.x - start.x, pt.y - start.y) < 10 / rf.getZoom());
    pointIndex.current = hit >= 0 ? hit : -1 - insertIndex(s, t, points, start);
  };
  const pointDrag = useDrag({ onStart: startPointDrag, onMove: (q) => pointDragMove(q) });

  /* ----- corpo da linha: ortogonal move o trecho; reta/curva cria dobra no ponto agarrado ----- */
  const body = useDrag({
    onStart: (start) => (lineType === 'smoothstep' ? grabSegment(start, 14) : startPointDrag(start)),
    onMove: (q) => (lineType === 'smoothstep' ? moveSegment(q) : pointDragMove(q)),
    onEnd: (moved) => {
      segRef.current = null;
      if (!moved) selectOnly(id);
    },
  });

  function pointDragMove(q: XYPosition) {
    const { updateEdgeData } = useBoard.getState();
    if (pointIndex.current < 0) {
      const i = -1 - pointIndex.current;
      const next = [...(edgeData(id).points ?? [])];
      next.splice(i, 0, round(q));
      pointIndex.current = i;
      updateEdgeData(id, { points: next });
      return;
    }
    const cur = edgeData(id).points ?? [];
    updateEdgeData(id, { points: cur.map((pt, i) => (i === pointIndex.current ? round(q) : pt)) });
  }

  /* ----- pontas: soltar em qualquer ponto da borda de um bloco ----- */
  const endHandle = (which: 's' | 't') =>
    useDrag({
      onMove: (q) => !endCancelled.current && setEndDrag({ which, p: q }),
      onEnd: (moved, at, q) => {
        const cancelled = endCancelled.current;
        endCancelled.current = false;
        setEndDrag(null);
        if (!moved || cancelled) return;
        const hit = document
          .elementsFromPoint(at.clientX, at.clientY)
          .map((el) => el.closest('.react-flow__node'))
          .find((el): el is HTMLElement => !!el && !el.classList.contains('react-flow__node-group'));
        const nodeId = hit?.dataset.id;
        const internal = nodeId ? rf.getInternalNode(nodeId) : undefined;
        if (!nodeId || !internal) return;
        const anchor = projectAnchor(internal, q);
        const handle = internal.type === 'erTable' ? null : handleFor(anchor);
        const patch = which === 's' ? { source: nodeId, sourceHandle: handle } : { target: nodeId, targetHandle: handle };
        useBoard.getState().updateEdge(id, {
          ...patch,
          // pontas novas => traçado automático de novo
          data: { ...d, [which === 's' ? 'sourceAnchor' : 'targetAnchor']: anchor, points: undefined, centerX: undefined, centerY: undefined },
        });
      },
    });
  const sDrag = endHandle('s');
  const tDrag = endHandle('t');

  const swap = () =>
    useBoard.getState().updateEdge(id, {
      source: p.target,
      target: p.source,
      sourceHandle: p.targetHandleId,
      targetHandle: p.sourceHandleId,
      data: { ...d, sourceAnchor: d.targetAnchor, targetAnchor: d.sourceAnchor, points: d.points ? [...d.points].reverse() : undefined },
    });

  return (
    <>
      {!er && (
        <defs>
          <Marker id={ms} kind={startKind} color={color} width={width} />
          <Marker id={me} kind={endKind} color={color} width={width} />
        </defs>
      )}
      <BaseEdge
        path={route.path}
        markerStart={er ? erMarker(from) : startKind !== 'none' ? `url(#${ms})` : undefined}
        markerEnd={er ? erMarker(to) : endKind !== 'none' ? `url(#${me})` : undefined}
        style={{
          stroke: color,
          strokeWidth: er ? (selected ? 2 : 1.5) : width,
          strokeDasharray: er ? undefined : DASHES[d.dash ?? 'solid'],
          strokeLinecap: d.dash === 'dotted' ? 'round' : undefined,
        }}
      />
      {/* contorno de seleção, por baixo, como no Lucidchart */}
      {selected && !er && <path d={route.path} fill="none" stroke="var(--mfd-brand)" strokeOpacity={0.25} strokeWidth={width + 6} style={{ pointerEvents: 'none' }} />}
      {/* área de captura invisível */}
      <path
        d={route.path}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(16, width + 12)}
        className="mfd-edge-hit nodrag nopan"
        style={{ cursor: selected ? 'move' : 'pointer', pointerEvents: 'stroke' }}
        {...body}
        onDoubleClick={(e) => {
          e.stopPropagation();
          useBoard.getState().updateEdgeData(id, { points: undefined, centerX: undefined, centerY: undefined });
        }}
      >
        <title>{selected ? 'Arraste para ajustar · duplo clique volta ao automático' : 'Clique para selecionar'}</title>
      </path>

      <EdgeLabelRenderer>
        {p.label && (
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${route.label.x}px, ${route.label.y}px)` }}
          >
            {String(p.label)}
          </div>
        )}
        {selected && !endDrag && (
          <>
            {/* ortogonal: pílulas nos trechos móveis */}
            {lineType === 'smoothstep' && route.segments.map((seg, i) => <SegmentPill key={`g${i}`} seg={seg} drag={pillDrag} />)}

            {/* reta/curva: pontos reais (quadrado vazado) e "meios" para criar dobra (quadradinho cheio) */}
            {lineType !== 'smoothstep' &&
              route.mids.map((m, i) => (
                <div
                  key={`m${i}`}
                  {...pointDrag}
                  title="Arraste para criar uma dobra"
                  className="nodrag nopan absolute h-2 w-2 rounded-[2px] bg-brand"
                  style={gripStyle(m, { cursor: 'move' })}
                />
              ))}
            {lineType !== 'smoothstep' &&
              points.map((pt, i) => (
                <div
                  key={`p${i}`}
                  {...pointDrag}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    useBoard.getState().updateEdgeData(id, { points: points.filter((_, k) => k !== i) });
                  }}
                  title="Arraste para mover · duplo clique remove a dobra"
                  className="nodrag nopan absolute h-2.5 w-2.5 rounded-[2px] border-2 border-brand bg-surface"
                  style={gripStyle(pt, { cursor: 'move' })}
                />
              ))}

            {!er && (
              <LineToolbar id={id} at={toolbarAt} d={d} lineType={lineType} color={color} width={width} startKind={startKind} endKind={endKind} swap={swap} />
            )}
          </>
        )}

        {/* pontas: continuam montadas DURANTE o arraste — se sumissem, o navegador perderia
            a captura do mouse e o arraste ficaria preso */}
        {selected &&
          !er &&
          ([['s', s, sDrag], ['t', t, tDrag]] as const).map(([k, pt, drag]) => (
            // área de clique grande e invisível; o quadradinho visível fica no centro.
            // Tamanhos em px de TELA (divididos pelo zoom), como no Lucidchart.
            <div
              key={k}
              {...drag}
              title="Arraste a ponta para qualquer ponto da borda de um bloco"
              className="nodrag nopan group/grip absolute flex items-center justify-center"
              style={gripStyle(pt, { width: gripHit / zoom, height: gripHit / zoom, cursor: 'crosshair' })}
            >
              <span
                className={`block rounded-[3px] border-2 border-brand shadow-soft transition-transform duration-100 group-hover/grip:scale-125 ${endDrag?.which === k ? 'bg-brand' : 'bg-surface'}`}
                style={{ width: 12 / zoom, height: 12 / zoom, borderWidth: 2 / zoom }}
              />
            </div>
          ))}
      </EdgeLabelRenderer>
    </>
  );
}

export function FlexEdge(props: EdgeProps) {
  return <LineEdge {...props} er={false} />;
}

export function ErRelationEdge(props: EdgeProps) {
  return <LineEdge {...props} er />;
}

// "smoothstep" / "straight" / "default" = linhas antigas; todas passam a usar a linha livre
export const edgeTypes = {
  erRelation: ErRelationEdge,
  flex: FlexEdge,
  smoothstep: FlexEdge,
  straight: FlexEdge,
  default: FlexEdge,
};
