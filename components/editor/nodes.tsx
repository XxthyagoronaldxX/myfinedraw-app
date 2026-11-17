'use client';

import { Handle, NodeProps, NodeResizer, Position } from '@xyflow/react';
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { assetUrl } from '@/lib/api';
import { CODE_LANGUAGES, highlightCode, languageLabel } from './code';
import { ErColumn, FlowShape, STICKY_COLORS } from './factory';
import { formatCode, reindentBraces } from './format';
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

/**
 * Texto editável com duplo clique.
 * Ao editar, o contêiner continua o mesmo (mesma centralização, cor e fonte) e
 * recebe um textarea transparente que cresce com o texto — o bloco não muda de visual.
 */
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

  // altura acompanha o conteúdo, para o texto continuar centralizado como na leitura
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, draft]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing)
    return (
      <div className={className} style={style}>
        <textarea
          ref={ref}
          rows={1}
          aria-label="Editar texto"
          className="nodrag nowheel m-0 block w-full resize-none overflow-hidden border-0 bg-transparent p-0 outline-none"
          style={{ color: 'inherit', font: 'inherit', lineHeight: 'inherit', textAlign: 'inherit', letterSpacing: 'inherit', caretColor: 'currentColor' }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(false);
            }
            if (e.key === 'Enter' && (!multiline || e.ctrlKey)) {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>
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
    case 'usecase':
      return <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 1} ry={h / 2 - 1} {...props} />;
    case 'actor': {
      // boneco UML: o desenho ocupa a parte de cima; o nome fica embaixo (ACTOR_LABEL_H)
      const fh = Math.max(20, h - ACTOR_LABEL_H);
      const cx = w / 2;
      const r = Math.min(w * 0.18, fh * 0.13);
      const headY = r + 2;
      const neck = headY + r;
      const hip = neck + fh * 0.38;
      const span = Math.min(w * 0.42, fh * 0.32);
      return (
        <g {...props} strokeLinecap="round" strokeLinejoin="round">
          <circle cx={cx} cy={headY} r={r} />
          <path d={`M${cx},${neck} V${hip} M${cx - span},${neck + fh * 0.13} H${cx + span} M${cx},${hip} L${cx - span * 0.8},${fh - 2} M${cx},${hip} L${cx + span * 0.8},${fh - 2}`} fill="none" />
        </g>
      );
    }
    default:
      return null;
  }
}

/** Altura reservada para o nome embaixo do boneco do ator UML. */
const ACTOR_LABEL_H = 26;

export const FlowNode = memo(function FlowNode({ id, data, selected, width, height }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as any;
  const w = width ?? 160;
  const h = height ?? 64;
  const actor = d.shape === 'actor';
  // cor vazia = cor de texto do tema (formas cujo texto/traço fica sobre o canvas)
  const ink = 'var(--mfd-ink)';
  const pad = d.shape === 'subprocess' ? 'px-5' : d.shape === 'decision' ? 'px-6' : d.shape === 'usecase' ? 'px-7' : 'px-3';
  return (
    <div className="relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={actor ? 40 : 60}
        minHeight={actor ? 70 : 30}
        lineClassName="!border-brand"
        handleClassName="!h-2 !w-2 !bg-surface !border-brand"
      />
      <svg className="absolute inset-0 overflow-visible" width={w} height={h} fill={d.fill || 'transparent'} stroke={d.stroke || ink}>
        {shapePath(d.shape, w, h)}
      </svg>
      <EditableText
        value={d.label}
        onCommit={(label) => updateNodeData(id, { label })}
        className={
          actor
            ? 'absolute inset-x-0 bottom-0 flex items-center justify-center whitespace-pre-wrap text-center leading-tight'
            : `absolute inset-0 flex items-center justify-center whitespace-pre-wrap text-center leading-tight ${pad}`
        }
        style={{ color: d.color || ink, fontSize: d.fontSize, width: w, height: actor ? ACTOR_LABEL_H : h }}
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
          className="nodrag nowheel block h-full w-full resize-none border-0 bg-transparent p-3 font-mono text-xs text-ink outline-none"
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

/* ---------------- Bloco de código ---------------- */

export const CodeNode = memo(function CodeNode({ id, data, selected }: NodeProps) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = data as { code: string; language: string; lineNumbers?: boolean; title?: string };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.code);
  const [copied, setCopied] = useState(false);
  const [fmtMsg, setFmtMsg] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const shown = editing ? draft : d.code;
  const { html, detected } = useMemo(() => highlightCode(shown, d.language), [shown, d.language]);
  const lines = shown.split('\n').length;
  const showNumbers = d.lineNumbers !== false;

  const startEdit = () => {
    setDraft(d.code);
    setEditing(true);
  };
  const commit = (value: string) => {
    setEditing(false);
    if (value !== d.code) updateNodeData(id, { code: value });
  };

  /** Troca o texto do textarea e reposiciona o cursor depois do render. */
  const setText = (value: string, a: number, b = a) => {
    setDraft(value);
    requestAnimationFrame(() => {
      const el = area.current;
      if (el) {
        el.selectionStart = a;
        el.selectionEnd = b;
      }
    });
  };

  const format = async () => {
    const src = editing ? draft : d.code;
    const lang = d.language === 'auto' ? detected ?? 'plaintext' : d.language;
    let out: string;
    try {
      out = await formatCode(src, lang);
      setFmtMsg('Formatado ✓');
    } catch {
      out = reindentBraces(src); // sintaxe inválida para o Prettier: ao menos reindenta
      setFmtMsg('Reindentado');
    }
    setTimeout(() => setFmtMsg(null), 1400);
    if (editing) setText(out, 0);
    else if (out !== d.code) updateNodeData(id, { code: out });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div
      className={`mfd-code flex h-full w-full flex-col overflow-hidden rounded-lg border shadow-soft ${selected ? 'border-brand' : 'border-white/10'}`}
    >
      <NodeResizer isVisible={selected} minWidth={200} minHeight={90} handleClassName="!h-2 !w-2 !bg-surface !border-brand" />

      {/* cabeçalho estilo editor: título, linguagem e copiar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/20 px-3 py-1.5">
        <span className="flex gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        {d.title ? <span className="truncate font-mono text-[11px] text-white/70">{d.title}</span> : null}
        <select
          aria-label="Linguagem"
          title="Linguagem"
          className="nodrag ml-auto max-w-[140px] cursor-pointer rounded bg-transparent px-1 py-0.5 font-mono text-[11px] text-white/70 outline-none hover:bg-white/10 focus:bg-white/10 [&>option]:bg-[#0d1321]"
          value={d.language}
          onChange={(e) => updateNodeData(id, { language: e.target.value })}
        >
          {CODE_LANGUAGES.map(([v, l]) => (
            <option key={v} value={v}>
              {v === 'auto' && detected ? `Auto (${languageLabel(detected)})` : l}
            </option>
          ))}
        </select>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault() /* não tira o foco do textarea */}
          onClick={format}
          className="nodrag rounded px-1.5 py-0.5 font-mono text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
          title="Formatar código (Shift+Alt+F)"
        >
          {fmtMsg ?? 'Formatar'}
        </button>
        <button
          type="button"
          onClick={copy}
          className="nodrag rounded px-1.5 py-0.5 font-mono text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
          title="Copiar código"
        >
          {copied ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>

      {/* mesma visualização ao ler e ao editar: o textarea transparente fica sobre o código destacado */}
      <div
        className={`nowheel min-h-0 flex-1 overflow-auto ${editing ? 'nodrag cursor-text' : ''}`}
        onDoubleClick={editing ? undefined : startEdit}
        title={editing ? undefined : 'Duplo clique para editar'}
      >
        <div className="flex min-h-full min-w-max py-3 font-mono text-[12.5px] leading-[1.6]">
          {showNumbers && (
            <div className="select-none pl-3 pr-3 text-right text-white/25" aria-hidden>
              {Array.from({ length: lines }, (_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <div className={`relative grid flex-1 ${showNumbers ? 'pr-4' : 'px-3'}`}>
            <pre className="m-0 whitespace-pre [grid-area:1/1]" aria-hidden={editing}>
              {/* o highlight.js escapa o código; o HTML contém só <span class="hljs-…"> */}
              <code className="hljs" dangerouslySetInnerHTML={{ __html: (html || ' ') + (shown.endsWith('\n') ? ' ' : '') }} />
            </pre>
            {editing && (
              <textarea
                ref={area}
                autoFocus
                spellCheck={false}
                wrap="off"
                aria-label="Editar código"
                className="m-0 h-full w-full resize-none overflow-hidden whitespace-pre border-0 bg-transparent p-0 font-mono text-[12.5px] leading-[1.6] text-transparent caret-white outline-none [grid-area:1/1]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={(e) => commit(e.target.value)}
                onKeyDown={(e) => {
                  const el = e.currentTarget;
                  const { selectionStart: a, selectionEnd: b, value } = el;
                  const lineStart = value.lastIndexOf('\n', a - 1) + 1;
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditing(false); // descarta
                  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    commit(value);
                  } else if (e.code === 'KeyF' && e.shiftKey && e.altKey) {
                    e.preventDefault();
                    format();
                  } else if (e.key === 'Enter') {
                    // mantém a indentação da linha atual (+1 nível depois de { ( [)
                    e.preventDefault();
                    const indent = /^[ \t]*/.exec(value.slice(lineStart, a))![0];
                    const extra = /[{([]\s*$/.test(value.slice(lineStart, a)) ? '  ' : '';
                    const ins = '\n' + indent + extra;
                    setText(value.slice(0, a) + ins + value.slice(b), a + ins.length);
                  } else if (e.key === 'Tab') {
                    // Tab / Shift+Tab indentam ou recuam as linhas selecionadas
                    e.preventDefault();
                    if (a === b && !e.shiftKey) {
                      setText(value.slice(0, a) + '  ' + value.slice(b), a + 2);
                      return;
                    }
                    const end = value.indexOf('\n', b - (b > a && value[b - 1] === '\n' ? 1 : 0));
                    const blockEnd = end === -1 ? value.length : end;
                    const block = value.slice(lineStart, blockEnd).split('\n');
                    let firstDelta = 0;
                    let total = 0;
                    const next = block.map((l, i) => {
                      if (e.shiftKey) {
                        const rm = /^ {1,2}/.exec(l)?.[0].length ?? 0;
                        if (i === 0) firstDelta = -rm;
                        total -= rm;
                        return l.slice(rm);
                      }
                      if (i === 0) firstDelta = 2;
                      total += 2;
                      return '  ' + l;
                    });
                    setText(value.slice(0, lineStart) + next.join('\n') + value.slice(blockEnd), Math.max(lineStart, a + firstDelta), b + total);
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>
      <SideHandles />
    </div>
  );
});

export const nodeTypes = {
  code: CodeNode,
  flow: FlowNode,
  erTable: ErTableNode,
  sticky: StickyNode,
  markdown: MarkdownNode,
  image: ImageNode,
};
