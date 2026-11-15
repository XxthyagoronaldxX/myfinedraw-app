'use client';

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  reconnectEdge,
} from '@xyflow/react';
import { create } from 'zustand';

type Snap = { nodes: Node[]; edges: Edge[] };

const HISTORY_LIMIT = 100;
/** Mudanças dentro desta janela viram um único passo de desfazer (ex.: digitar, arrastar). */
const COALESCE_MS = 600;

interface BoardState {
  nodes: Node[];
  edges: Edge[];
  past: Snap[];
  future: Snap[];
  lastRecordAt: number;
  /** Incrementa a cada mudança de conteúdo — dispara o autosave. */
  version: number;
  edgeType: string;

  load: (nodes: Node[], edges: Edge[]) => void;
  record: (force?: boolean) => void;
  touch: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  /** Nova linha solta em qualquer ponto da borda do bloco de destino. */
  connectAnchored: (c: {
    source: string;
    sourceHandle: string | null;
    target: string;
    targetHandle: string | null;
    targetAnchor: { x: number; y: number };
  }) => void;
  /** Arrastar a ponta de uma linha para outro ponto de conexão. */
  onReconnect: (oldEdge: Edge, c: Connection) => void;
  setEdgeType: (t: string) => void;
  addElements: (nodes: Node[], edges?: Edge[], select?: boolean) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  updateEdge: (id: string, patch: Partial<Edge>) => void;
  updateEdgeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (nodes: Node[]) => Node[]) => void;
  deleteSelected: () => void;
  undo: () => void;
  redo: () => void;
}

const isContentChange = (c: NodeChange) =>
  c.type === 'remove' ||
  c.type === 'add' ||
  c.type === 'replace' ||
  (c.type === 'position' && !!c.position) ||
  (c.type === 'dimensions' && c.resizing !== undefined);

export const useBoard = create<BoardState>((set, get) => ({
  nodes: [],
  edges: [],
  past: [],
  future: [],
  lastRecordAt: 0,
  version: 0,
  edgeType: 'smoothstep',

  load: (nodes, edges) => set({ nodes, edges, past: [], future: [], lastRecordAt: 0, version: 0 }),

  record: (force = false) => {
    const now = Date.now();
    const { nodes, edges, past, lastRecordAt } = get();
    if (!force && now - lastRecordAt < COALESCE_MS) {
      set({ lastRecordAt: now });
      return;
    }
    set({ past: [...past.slice(-HISTORY_LIMIT + 1), { nodes, edges }], future: [], lastRecordAt: now });
  },

  touch: () => set((s) => ({ version: s.version + 1 })),

  onNodesChange: (changes) => {
    const content = changes.some(isContentChange);
    if (content) get().record();
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes), version: content ? s.version + 1 : s.version }));
  },

  onEdgesChange: (changes) => {
    const content = changes.some((c) => c.type !== 'select');
    if (content) get().record();
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges), version: content ? s.version + 1 : s.version }));
  },

  onConnect: (c) => {
    get().record(true);
    const { nodes, edgeType } = get();
    const src = nodes.find((n) => n.id === c.source);
    const tgt = nodes.find((n) => n.id === c.target);
    const isEr = src?.type === 'erTable' && tgt?.type === 'erTable';
    const edge: Edge = isEr
      ? { ...c, id: crypto.randomUUID(), type: 'erRelation', data: { cardinality: 'N:1' } }
      : { ...c, id: crypto.randomUUID(), type: 'flex', data: { lineType: edgeType, endMarker: 'arrow' } };
    // como no Lucidchart, a linha recém-criada já vem selecionada
    set((s) => ({
      nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: addEdge({ ...edge, selected: true }, s.edges.map((e) => (e.selected ? { ...e, selected: false } : e))),
      version: s.version + 1,
    }));
  },

  connectAnchored: ({ source, sourceHandle, target, targetHandle, targetAnchor }) => {
    get().record(true);
    const edge: Edge = {
      id: crypto.randomUUID(),
      type: 'flex',
      source,
      sourceHandle,
      target,
      targetHandle,
      data: { lineType: get().edgeType, endMarker: 'arrow', targetAnchor },
    };
    set((s) => ({
      nodes: s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
      edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), { ...edge, selected: true }],
      version: s.version + 1,
    }));
  },

  onReconnect: (oldEdge, c) => {
    get().record(true);
    set((s) => ({
      // o traçado manual (centerX/centerY) deixa de fazer sentido com novas pontas
      edges: reconnectEdge(oldEdge, c, s.edges, { shouldReplaceId: false }).map((e) =>
        e.id === oldEdge.id ? { ...e, data: { ...e.data, centerX: undefined, centerY: undefined } } : e,
      ),
      version: s.version + 1,
    }));
  },

  setEdgeType: (edgeType) => set({ edgeType }),

  addElements: (nodes, edges = [], select = true) => {
    get().record(true);
    set((s) => ({
      nodes: [
        ...(select ? s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)) : s.nodes),
        ...nodes.map((n) => ({ ...n, selected: select })),
      ],
      edges: [...s.edges, ...edges],
      version: s.version + 1,
    }));
  },

  updateNode: (id, patch) => {
    get().record();
    set((s) => ({ nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)), version: s.version + 1 }));
  },

  updateNodeData: (id, patch) => {
    get().record();
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      version: s.version + 1,
    }));
  },

  updateEdge: (id, patch) => {
    get().record();
    set((s) => ({ edges: s.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)), version: s.version + 1 }));
  },

  updateEdgeData: (id, patch) => {
    get().record();
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)),
      version: s.version + 1,
    }));
  },

  setNodes: (fn) => {
    get().record(true);
    set((s) => ({ nodes: fn(s.nodes), version: s.version + 1 }));
  },

  deleteSelected: () => {
    const { nodes, edges } = get();
    const removed = new Set(nodes.filter((n) => n.selected || (n.parentId && nodes.find((p) => p.id === n.parentId)?.selected)).map((n) => n.id));
    if (!removed.size && !edges.some((e) => e.selected)) return;
    get().record(true);
    set((s) => ({
      nodes: s.nodes.filter((n) => !removed.has(n.id)),
      edges: s.edges.filter((e) => !e.selected && !removed.has(e.source) && !removed.has(e.target)),
      version: s.version + 1,
    }));
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    const prev = past.at(-1);
    if (!prev) return;
    set((s) => ({ ...prev, past: past.slice(0, -1), future: [{ nodes, edges }, ...future], lastRecordAt: 0, version: s.version + 1 }));
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    const next = future[0];
    if (!next) return;
    set((s) => ({ ...next, past: [...past, { nodes, edges }], future: future.slice(1), lastRecordAt: 0, version: s.version + 1 }));
  },
}));

/** Remove estado efêmero do React Flow antes de salvar. */
export function serialize(nodes: Node[], edges: Edge[]) {
  return {
    nodes: nodes.map(({ selected, dragging, measured, resizing, ...n }: any) => n),
    edges: edges.map(({ selected, ...e }: any) => e),
  };
}
