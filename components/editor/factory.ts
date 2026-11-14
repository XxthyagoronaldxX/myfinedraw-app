import type { Node, XYPosition } from '@xyflow/react';

export type FlowShape = 'terminal' | 'process' | 'decision' | 'io' | 'document' | 'subprocess' | 'text';

export interface ErColumn {
  id: string;
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
  nullable?: boolean;
  unique?: boolean;
}

export const STICKY_COLORS: Record<string, string> = {
  yellow: '#FEF08A',
  green: '#BBF7D0',
  blue: '#BFDBFE',
  pink: '#FBCFE8',
  orange: '#FED7AA',
  purple: '#DDD6FE',
};

export const SQL_TYPES = ['uuid', 'serial', 'bigserial', 'integer', 'bigint', 'numeric(10,2)', 'text', 'varchar(255)', 'boolean', 'date', 'timestamp', 'timestamptz', 'jsonb'];

const id = () => crypto.randomUUID();

const FLOW_SIZES: Record<FlowShape, { width: number; height: number; label: string }> = {
  terminal: { width: 140, height: 56, label: 'Início' },
  process: { width: 160, height: 64, label: 'Processo' },
  decision: { width: 140, height: 100, label: 'Decisão?' },
  io: { width: 170, height: 64, label: 'Entrada/Saída' },
  document: { width: 160, height: 76, label: 'Documento' },
  subprocess: { width: 170, height: 64, label: 'Subprocesso' },
  text: { width: 160, height: 40, label: 'Texto' },
};

export function createFlowNode(shape: FlowShape, center: XYPosition): Node {
  const s = FLOW_SIZES[shape];
  return {
    id: id(),
    type: 'flow',
    position: { x: center.x - s.width / 2, y: center.y - s.height / 2 },
    width: s.width,
    height: s.height,
    data: {
      shape,
      label: s.label,
      fill: shape === 'text' ? 'transparent' : shape === 'decision' ? '#FEF3C7' : shape === 'terminal' ? '#DCFCE7' : '#E0E7FF',
      stroke: shape === 'text' ? 'transparent' : shape === 'decision' ? '#D97706' : shape === 'terminal' ? '#16A34A' : '#4F46E5',
      color: '#18181b',
      fontSize: 14,
    },
  };
}

export function createTableNode(center: XYPosition): Node {
  return {
    id: id(),
    type: 'erTable',
    position: { x: center.x - 130, y: center.y - 60 },
    width: 260,
    data: {
      name: 'nova_tabela',
      color: '#6366F1',
      columns: [
        { id: id(), name: 'id', type: 'uuid', pk: true, nullable: false },
        { id: id(), name: 'created_at', type: 'timestamptz', nullable: false },
      ] satisfies ErColumn[],
    },
  };
}

export function createStickyNode(center: XYPosition): Node {
  return {
    id: id(),
    type: 'sticky',
    position: { x: center.x - 90, y: center.y - 90 },
    width: 180,
    height: 180,
    data: { text: 'Nova nota', color: 'yellow' },
  };
}

export function createMarkdownNode(center: XYPosition): Node {
  return {
    id: id(),
    type: 'markdown',
    position: { x: center.x - 160, y: center.y - 100 },
    width: 320,
    height: 200,
    data: { text: '## Título\n\n- [ ] tarefa\n- [x] feita\n\nTexto em **Markdown**.' },
  };
}

export function createImageNode(center: XYPosition, asset: { id: string; url: string }, natural?: { w: number; h: number }): Node {
  let width = natural?.w ?? 320;
  let height = natural?.h ?? 200;
  const max = 480;
  if (width > max) {
    height = Math.round((height * max) / width);
    width = max;
  }
  return {
    id: id(),
    type: 'image',
    position: { x: center.x - width / 2, y: center.y - height / 2 },
    width,
    height,
    data: { assetId: asset.id, url: asset.url, caption: '' },
  };
}

export function newColumn(): ErColumn {
  return { id: id(), name: 'coluna', type: 'text', nullable: true };
}

/** Tipos de dado do arrastar-e-soltar interno (dock → canvas, galeria → canvas). */
export const DND_TOOL = 'application/x-mfd-tool';
export const DND_ASSET = 'application/x-mfd-asset';
