'use client';

import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { assetUrl } from '@/lib/api';
import { ErColumn, FlowShape, STICKY_COLORS } from './factory';
import { useBoard } from './store';

/* Handles nos 4 lados; com ConnectionMode.Loose qualquer um conecta com qualquer um. */
function SideHandles() {
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} />
      <Handle id="r" type="source" position={Position.Right} />
      <Handle id="b" type="source" position={Position.Bottom} />
      <Handle id="l" type="source" position={Position.Left} />
    </>
  );
}

/** Texto editável com duplo clique. */
function EditableText({
  value,
  onCommit,
  className,
  style,
  multiline = true,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  style?: React.CSSProperties;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      setTimeout(() => ref.current?.select());
    }
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing)
    return (
      <textarea
        ref={ref}
        className={`nodrag nowheel resize-none bg-surface outline-none ${className ?? ''}`}
        style={style}
        value={draft}
        rows={multiline ? undefined : 1}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter' && (!multiline || e.ctrlKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
    );
  return (
    <div className={className} style={style} onDoubleClick={() => setEditing(true)}>
      {value || <span className="opacity-40">…</span>}
    </div>
  );
}

/* ---------------- Fluxograma ---------------- */

function shapePath(shape: FlowShape, w: number, h: number): React.ReactElement | null {
  const sw = 2;
  const props = { strokeWidth: sw, vectorEffect: 'non-scaling-stroke' as const };
  switch (shape) {
    case 'terminal':
      return <rect x={1} y={1} width={w - 2} height={h - 2} rx={(h - 2) / 2} {...props} />;
    case 'process':
      return <rect x={1} y={1} width={w - 2} height={h - 2} rx={4} {...props} />;
    case 'decision':
      return <polygon points={`${w / 2},1 ${w - 1},${h / 2} ${w / 2},${h - 1} 1,${h / 2}`} {...props} />;
    case 'io': {
      const o = Math.min(24, w * 0.15);
      return <polygon points={`${o},1 ${w - 1},1 ${w - o},${h - 1} 1,${h - 1}`} {...props} />;
    }
    case 'document':
      return <path d={`M1,1 H${w - 1} V${h * 0.82} C${w * 0.75},${h * 0.65} ${w * 0.25},${h * 1.05} 1,${h * 0.85} Z`} {...props} />;
    case 'subprocess':
      return (
        <g {...props}>
          <rect x={1} y={1} width={w - 2} height={h - 2} rx={2} />
          <line x1={12} y1={1} x2={12} y2={h - 1} />
          <line x1={w - 12} y1={1} x2={w - 12} y2={h - 1} />
        </g>
      );
    default:
      return null;
  }
}

export const FlowNode = memo(function FlowNode({ id, data, selected, width, height }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as any;
  const w = width ?? 160;
  const h = height ?? 64;
  return (
    <div className="relative h-full w-full">
      <NodeResizer isVisible={selected} minWidth={60} minHeight={30} lineClassName="!border-brand" handleClassName="!h-2 !w-2 !bg-surface !border-brand" />
      <svg className="absolute inset-0 overflow-visible" width={w} height={h} fill={d.fill} stroke={d.stroke}>
        {shapePath(d.shape, w, h)}
      </svg>
      <EditableText
        value={d.label}
        onCommit={(label) => updateNodeData(id, { label })}
        className={`absolute inset-0 flex items-center justify-center whitespace-pre-wrap text-center leading-tight ${d.shape === 'subprocess' ? 'px-5' : d.shape === 'decision' ? 'px-6' : 'px-3'}`}
        style={{ color: d.color, fontSize: d.fontSize, width: w, height: h }}
      />
      <SideHandles />
    </div>
  );
});

/* ---------------- Tabela ER ---------------- */

export const ErTableNode = memo(function ErTableNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as { name: string; color: string; columns: ErColumn[] };
  return (
    <div className={`w-full overflow-visible rounded-md border bg-surface text-xs shadow-sm ${selected ? 'ring-2 ring-brand' : ''}`} style={{ borderColor: d.color }}>
      <div className="rounded-t-[5px] px-3 py-1.5 font-semibold text-white" style={{ background: d.color }}>
        <EditableText value={d.name} multiline={false} onCommit={(name) => updateNodeData(id, { name })} className="w-full text-sm" />
      </div>
      {d.columns.map((c) => (
        <div key={c.id} className="relative flex items-center gap-2 border-t border-line px-3 py-1">
          <Handle id={`c:${c.id}:l`} type="source" position={Position.Left} className="!-left-1" />
          <span className="w-6 shrink-0 text-[10px] font-bold">
            {c.pk ? <span className="text-amber-600">PK</span> : c.fk ? <span className="text-sky-600">FK</span> : ''}
          </span>
          <span className={`flex-1 truncate ${c.pk ? 'font-semibold' : ''}`}>{c.name}</span>
          <span className="truncate text-muted">
            {c.type}
            {c.nullable === false && !c.pk ? ' !' : ''}
          </span>
          <Handle id={`c:${c.id}:r`} type="source" position={Position.Right} className="!-right-1" />
        </div>
      ))}
      {d.columns.length === 0 && <div className="px-3 py-2 text-muted">sem colunas</div>}
    </div>
  );
});

/* ---------------- Notas ---------------- */

export const StickyNode = memo(function StickyNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as { text: string; color: string };
  return (
    <div className="h-full w-full p-3 shadow-md" style={{ background: STICKY_COLORS[d.color] ?? d.color }}>
      <NodeResizer isVisible={selected} minWidth={100} minHeight={80} handleClassName="!h-2 !w-2 !bg-surface !border-brand" />
      <EditableText value={d.text} onCommit={(text) => updateNodeData(id, { text })} className="h-full w-full overflow-hidden whitespace-pre-wrap text-sm text-ink" />
      <SideHandles />
    </div>
  );
});

export const MarkdownNode = memo(function MarkdownNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const [editing, setEditing] = useState(false);
  const d = data as { text: string };
  return (
    <div className={`h-full w-full overflow-hidden rounded-md border bg-surface shadow-sm ${selected ? 'border-brand' : 'border-line'}`}>
      <NodeResizer isVisible={selected} minWidth={160} minHeight={80} handleClassName="!h-2 !w-2 !bg-surface !border-brand" />
      {editing ? (
        <textarea
          autoFocus
          className="nodrag nowheel h-full w-full resize-none p-3 font-mono text-xs outline-none"
          defaultValue={d.text}
          onBlur={(e) => {
            setEditing(false);
            if (e.target.value !== d.text) updateNodeData(id, { text: e.target.value });
          }}
          onKeyDown={(e) => e.key === 'Escape' && (e.target as HTMLTextAreaElement).blur()}
        />
      ) : (
        <div className="md nowheel h-full overflow-auto p-3 text-sm" onDoubleClick={() => setEditing(true)}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.text}</ReactMarkdown>
        </div>
      )}
      <SideHandles />
    </div>
  );
});

/* ---------------- Imagem ---------------- */

export const ImageNode = memo(function ImageNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as { url: string; caption?: string };
  return (
    <div className="flex h-full w-full flex-col">
      <NodeResizer isVisible={selected} keepAspectRatio minWidth={40} minHeight={30} handleClassName="!h-2 !w-2 !bg-surface !border-brand" />
      <img src={assetUrl(d.url)} crossOrigin="anonymous" alt={d.caption ?? ''} draggable={false} className={`min-h-0 w-full flex-1 rounded object-contain ${selected ? 'outline-2 outline-brand' : ''}`} />
      {d.caption !== undefined && d.caption !== '' && (
        <EditableText value={d.caption} multiline={false} onCommit={(caption) => updateNodeData(id, { caption })} className="mt-1 text-center text-xs text-ink-soft" />
      )}
      <SideHandles />
    </div>
  );
});

export const nodeTypes = {
  flow: FlowNode,
  erTable: ErTableNode,
  sticky: StickyNode,
  markdown: MarkdownNode,
  image: ImageNode,
};
