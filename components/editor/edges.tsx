'use client';

import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, Position, useReactFlow } from '@xyflow/react';
import { useRef } from 'react';
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

/**
 * Linha ortogonal cujo trecho do meio pode ser arrastado (data.centerX / data.centerY).
 * Duplo clique na linha volta ao traçado automático.
 */
function useOrthogonal(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props;
  const d = (data ?? {}) as { centerX?: number; centerY?: number };
  const horizontalExits = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const [path, lx, ly] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    borderRadius: 8, centerX: d.centerX, centerY: d.centerY,
  });

  const rf = useReactFlow();
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // O React Flow só usa o eixo que faz sentido para o formato da linha
  // (centerX para trechos verticais, centerY para horizontais — ex.: linhas "de volta"),
  // então gravamos os dois e o trecho segue o mouse em qualquer caso.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    drag.current = { sx: p.x, sy: p.y, ox: lx, oy: ly, moved: false };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const dx = p.x - g.sx;
    const dy = p.y - g.sy;
    if (!g.moved && Math.hypot(dx, dy) * rf.getZoom() < DRAG_THRESHOLD) return;
    g.moved = true;
    useBoard.getState().updateEdgeData(id, { centerX: Math.round(g.ox + dx), centerY: Math.round(g.oy + dy) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = drag.current;
    drag.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // sem movimento = clique normal: seleciona a linha
    if (g && !g.moved) {
      useBoard.setState((s) => ({
        nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
        edges: s.edges.map((x) => (x.selected !== (x.id === id) ? { ...x, selected: x.id === id } : x)),
      }));
    }
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (d.centerX !== undefined || d.centerY !== undefined) useBoard.getState().updateEdgeData(id, { centerX: undefined, centerY: undefined });
  };

  const dragProps = { onPointerDown, onPointerMove, onPointerUp, onDoubleClick };
  const cursor = 'move';
  return { path, lx, ly, dragProps, cursor, horizontalExits };
}

/** Área de captura invisível sobre a linha + alça visível quando selecionada. */
function DragLayer({ edge, o, labelOffset }: { edge: EdgeProps; o: ReturnType<typeof useOrthogonal>; labelOffset?: boolean }) {
  return (
    <>
      <path
        d={o.path}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="nodrag nopan"
        style={{ cursor: o.cursor, pointerEvents: 'stroke' }}
        {...o.dragProps}
      >
        <title>Arraste para mover a linha · duplo clique para voltar ao automático</title>
      </path>
      {edge.selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute flex items-center justify-center rounded-full border-2 border-brand bg-surface shadow-soft"
            style={{
              width: 14,
              height: 14,
              transform: `translate(-50%, -50%) translate(${o.lx}px, ${o.ly + (labelOffset ? -18 : 0)}px)`,
              pointerEvents: 'all',
              cursor: o.cursor,
            }}
            title="Arraste para mover a linha"
            {...o.dragProps}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function Label({ text, x, y }: { text: string; x: number; y: number }) {
  return (
    <EdgeLabelRenderer>
      <div
        className="nodrag nopan pointer-events-none absolute rounded bg-surface px-1.5 py-0.5 text-[11px] text-ink-soft shadow-sm"
        style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      >
        {text}
      </div>
    </EdgeLabelRenderer>
  );
}

export function ErRelationEdge(props: EdgeProps) {
  const o = useOrthogonal(props);
  const [from, to] = String((props.data as any)?.cardinality ?? 'N:1').split(':');
  const marker = (side: string) => (side === 'N' ? 'url(#er-many)' : 'url(#er-one)');
  return (
    <>
      <BaseEdge
        path={o.path}
        markerStart={marker(from)}
        markerEnd={marker(to)}
        style={{ stroke: props.selected ? 'var(--mfd-brand)' : 'var(--mfd-ink-soft)', strokeWidth: props.selected ? 2 : 1.5 }}
      />
      <DragLayer edge={props} o={o} labelOffset={!!props.label} />
      {props.label && <Label text={String(props.label)} x={o.lx} y={o.ly} />}
    </>
  );
}

/** Conector ortogonal do fluxograma (substitui o "smoothstep" padrão) com trecho arrastável. */
export function FlowStepEdge(props: EdgeProps) {
  const o = useOrthogonal(props);
  return (
    <>
      <BaseEdge path={o.path} markerEnd={props.markerEnd} markerStart={props.markerStart} style={props.style} />
      <DragLayer edge={props} o={o} labelOffset={!!props.label} />
      {props.label && <Label text={String(props.label)} x={o.lx} y={o.ly} />}
    </>
  );
}

export const edgeTypes = { erRelation: ErRelationEdge, smoothstep: FlowStepEdge };
