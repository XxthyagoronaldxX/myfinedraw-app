import type { Node, XYPosition } from '@xyflow/react';
import { SAMPLE_CODE } from './code';

export type FlowShape = 'terminal' | 'process' | 'decision' | 'io' | 'document' | 'subprocess' | 'text' | 'actor' | 'usecase';

/** Formas cujo texto fica fora do desenho, direto sobre o canvas: usam a cor de texto do tema. */
export const TEXT_ON_CANVAS: FlowShape[] = ['text', 'actor'];

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
  // UML
  actor: { width: 90, height: 130, label: 'Ator' },
  usecase: { width: 180, height: 76, label: 'Caso de uso' },
};

/** Cores padrão por forma (string vazia = cor do tema, ajusta ao claro/escuro). */
const FLOW_COLORS: Partial<Record<FlowShape, { fill: string; stroke: string; color: string }>> = {
  text: { fill: 'transparent', stroke: 'transparent', color: '' },
  actor: { fill: 'transparent', stroke: '', color: '' },
  decision: { fill: '#FEF3C7', stroke: '#D97706', color: '#18181b' },
  terminal: { fill: '#DCFCE7', stroke: '#16A34A', color: '#18181b' },
  usecase: { fill: '#FCE7F3', stroke: '#DB2777', color: '#18181b' },
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
      ...(FLOW_COLORS[shape] ?? { fill: '#E0E7FF', stroke: '#4F46E5', color: '#18181b' }),
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

export function createCodeNode(center: XYPosition): Node {
  return {
    id: id(),
    type: 'code',
    position: { x: center.x - 220, y: center.y - 120 },
    width: 440,
    height: 240,
    data: { code: SAMPLE_CODE, language: 'typescript', lineNumbers: true, title: '' },
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
