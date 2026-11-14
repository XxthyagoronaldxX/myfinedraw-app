'use client';

import { Node, NodePositionChange, useStore } from '@xyflow/react';

/**
 * Snap de alinhamento (estilo Lucidchart): ao arrastar um bloco, suas bordas e
 * centro "grudam" nas bordas/centros dos outros blocos próximos, com guias visuais.
 */

export interface Guides {
  /** x (coordenada do fluxo) de uma guia vertical */
  vertical?: number;
  /** y (coordenada do fluxo) de uma guia horizontal */
  horizontal?: number;
}

const size = (n: Node) => ({
  w: n.measured?.width ?? n.width ?? 0,
  h: n.measured?.height ?? n.height ?? 0,
});

/** Ajusta a posição do bloco arrastado e devolve as guias a desenhar. */
export function snapToNodes(change: NodePositionChange, nodes: Node[], threshold: number): Guides {
  const guides: Guides = {};
  const me = nodes.find((n) => n.id === change.id);
  if (!me || !change.position || me.parentId) return guides;
  const { w, h } = size(me);
  if (!w || !h) return guides;

  const { x, y } = change.position;
  // âncoras do bloco arrastado: esquerda, centro, direita / topo, meio, base
  const mine = {
    x: [x, x + w / 2, x + w],
    y: [y, y + h / 2, y + h],
  };

  let bestX = { dist: threshold, delta: 0, line: undefined as number | undefined };
  let bestY = { dist: threshold, delta: 0, line: undefined as number | undefined };

  for (const other of nodes) {
    if (other.id === me.id || other.parentId || other.selected) continue;
    const o = size(other);
    if (!o.w || !o.h) continue;
    const ox = [other.position.x, other.position.x + o.w / 2, other.position.x + o.w];
    const oy = [other.position.y, other.position.y + o.h / 2, other.position.y + o.h];

    for (const a of mine.x)
      for (const b of ox) {
        const d = Math.abs(a - b);
        if (d < bestX.dist) bestX = { dist: d, delta: b - a, line: b };
      }
    for (const a of mine.y)
      for (const b of oy) {
        const d = Math.abs(a - b);
        if (d < bestY.dist) bestY = { dist: d, delta: b - a, line: b };
      }
  }

  if (bestX.line !== undefined) {
    change.position.x = x + bestX.delta;
    guides.vertical = bestX.line;
  }
  if (bestY.line !== undefined) {
    change.position.y = y + bestY.delta;
    guides.horizontal = bestY.line;
  }
  return guides;
}

/** Desenha as guias por cima do canvas, convertendo coordenadas do fluxo para a tela. */
export function GuideLines({ guides }: { guides: Guides }) {
  const [tx, ty, zoom] = useStore((s) => s.transform);
  if (guides.vertical === undefined && guides.horizontal === undefined) return null;
  return (
    <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-visible">
      {guides.vertical !== undefined && (
        <line
          x1={guides.vertical * zoom + tx}
          x2={guides.vertical * zoom + tx}
          y1={0}
          y2="100%"
          stroke="var(--mfd-brand)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
      {guides.horizontal !== undefined && (
        <line
          y1={guides.horizontal * zoom + ty}
          y2={guides.horizontal * zoom + ty}
          x1={0}
          x2="100%"
          stroke="var(--mfd-brand)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}
    </svg>
  );
}
