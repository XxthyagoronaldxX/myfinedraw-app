'use client';

import { Edge, MarkerType, Node } from '@xyflow/react';
import { ArrowDown, ArrowUp, MousePointerClick, Plus, X } from 'lucide-react';
import { useId } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ErColumn, newColumn, STICKY_COLORS } from './factory';
import SqlTypeCombobox from './SqlTypeCombobox';
import { useBoard } from './store';

const SHAPES = [
  ['terminal', 'Início/Fim'],
  ['process', 'Processo'],
  ['decision', 'Decisão'],
  ['io', 'Entrada/Saída'],
  ['document', 'Documento'],
  ['subprocess', 'Subprocesso'],
  ['text', 'Texto livre'],
];

/* ---------- campos padronizados (shadcn Field) ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line p-4">
      <h3 className="eyebrow mb-3">{title}</h3>
      <FieldGroup className="gap-4">{children}</FieldGroup>
    </section>
  );
}

function TextField({ label, value, onChange, multiline, rows = 3, mono, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {multiline ? (
        <Textarea id={id} rows={rows} className={cn('resize-y', mono && 'font-mono text-xs')} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function ColorField({ label, value, onChange, allowTransparent = true }: { label: string; value: string; onChange: (v: string) => void; allowTransparent?: boolean }) {
  const id = useId();
  const transparent = value === 'transparent';
  return (
    <Field orientation="horizontal" className="justify-between gap-2">
      <FieldLabel htmlFor={id} className="font-normal text-muted-foreground">{label}</FieldLabel>
      <div className="flex items-center gap-1.5">
        {allowTransparent && (
          <button
            type="button"
            title="Transparente"
            onClick={() => onChange(transparent ? '#ffffff' : 'transparent')}
            className={cn('h-8 rounded-md border border-input px-2 font-mono text-[10px] transition', transparent ? 'bg-ink text-surface' : 'text-muted-foreground hover:bg-accent')}
          >
            ∅
          </button>
        )}
        <label
          className="relative flex h-8 w-24 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-1.5 shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50"
          title={value}
        >
          <span
            className="h-5 w-5 shrink-0 rounded"
            style={{ background: transparent ? 'repeating-conic-gradient(var(--mfd-line) 0 25%, transparent 0 50%) 0 0/8px 8px' : value }}
          />
          <span className="truncate font-mono text-[11px] uppercase text-ink-soft">{transparent ? 'nenhum' : value}</span>
          <input id={id} type="color" className="absolute inset-0 cursor-pointer opacity-0" value={transparent ? '#ffffff' : value} onChange={(e) => onChange(e.target.value)} />
        </label>
      </div>
    </Field>
  );
}

function CheckField({ label, checked, onChange, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; title?: string }) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="w-auto gap-1.5" title={title}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <FieldLabel htmlFor={id} className="text-xs font-normal">{label}</FieldLabel>
    </Field>
  );
}

function IconButton({ title, onClick, children, danger }: { title: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn('flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent', danger ? 'hover:text-destructive' : 'hover:text-ink')}
    >
      {children}
    </button>
  );
}

function RightClickHint() {
  return (
    <p className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
      <MousePointerClick className="h-4 w-4 shrink-0" /> Clique com o botão direito no bloco para organizar, duplicar ou excluir.
    </p>
  );
}

/* ---------- painel ---------- */

export default function PropertiesPanel() {
  const nodes = useBoard((s) => s.nodes);
  const edges = useBoard((s) => s.edges);
  const selNodes = nodes.filter((n) => n.selected);
  const selEdges = edges.filter((e) => e.selected);

  if (selNodes.length === 0 && selEdges.length === 0) return null;
  if (selNodes.length === 1 && selEdges.length === 0) return <NodePanel node={selNodes[0]} />;
  if (selEdges.length === 1 && selNodes.length === 0) return <EdgePanel edge={selEdges[0]} />;
  return (
    <>
      <Section title="Seleção">
        <p className="text-sm text-ink">{selNodes.length + selEdges.length} itens selecionados</p>
      </Section>
      <RightClickHint />
    </>
  );
}

function NodePanel({ node }: { node: Node }) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = node.data as any;
  const set = (patch: Record<string, unknown>) => updateNodeData(node.id, patch);

  return (
    <div>
      {node.type === 'flow' && (
        <Section title="Forma">
          <SelectField label="Tipo" value={d.shape} options={SHAPES as any} onChange={(shape) => set({ shape })} />
          <TextField label="Texto" multiline rows={2} value={d.label} onChange={(label) => set({ label })} />
          <ColorField label="Preenchimento" value={d.fill} onChange={(fill) => set({ fill })} />
          <ColorField label="Borda" value={d.stroke} onChange={(stroke) => set({ stroke })} />
          <ColorField label="Texto" value={d.color} allowTransparent={false} onChange={(color) => set({ color })} />
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor={`fs-${node.id}`} className="font-normal text-muted-foreground">Tamanho da fonte</FieldLabel>
            <Input id={`fs-${node.id}`} type="number" min={8} max={72} className="w-20" value={d.fontSize} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
          </Field>
        </Section>
      )}

      {node.type === 'erTable' && <TablePanel node={node} />}

      {node.type === 'sticky' && (
        <Section title="Nota">
          <Field className="gap-1.5">
            <FieldLabel>Cor</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STICKY_COLORS).map(([k, c]) => (
                <button
                  key={k}
                  type="button"
                  aria-label={k}
                  className={cn('h-8 w-8 rounded-md border border-black/10 transition', d.color === k ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : 'hover:scale-105')}
                  style={{ background: c }}
                  onClick={() => set({ color: k })}
                />
              ))}
            </div>
          </Field>
          <TextField label="Texto" multiline rows={5} value={d.text} onChange={(text) => set({ text })} />
        </Section>
      )}

      {node.type === 'markdown' && (
        <Section title="Markdown">
          <TextField label="Conteúdo" multiline rows={14} mono value={d.text} onChange={(text) => set({ text })} />
        </Section>
      )}

      {node.type === 'image' && (
        <Section title="Imagem">
          <TextField label="Legenda" value={d.caption ?? ''} placeholder="Sem legenda" onChange={(caption) => set({ caption })} />
        </Section>
      )}

      {node.type === 'group' && (
        <Section title="Grupo">
          <p className="text-sm text-ink-soft">Os blocos do grupo se movem juntos.</p>
        </Section>
      )}

      <RightClickHint />
    </div>
  );
}

function TablePanel({ node }: { node: Node }) {
  const updateNodeData = useBoard((s) => s.updateNodeData);
  const d = node.data as { name: string; color: string; columns: ErColumn[] };
  const setCols = (columns: ErColumn[]) => updateNodeData(node.id, { columns });
  const patchCol = (id: string, patch: Partial<ErColumn>) => setCols(d.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const move = (i: number, dir: -1 | 1) => {
    const cols = [...d.columns];
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    setCols(cols);
  };

  return (
    <Section title="Tabela">
      <TextField label="Nome" value={d.name} onChange={(name) => updateNodeData(node.id, { name })} />
      <ColorField label="Cor" value={d.color} allowTransparent={false} onChange={(color) => updateNodeData(node.id, { color })} />

      <Field className="gap-1.5">
        <FieldLabel>Colunas</FieldLabel>
        <div className="space-y-2">
          {d.columns.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-line bg-surface-2/50 p-2">
              <div className="grid grid-cols-[1fr_7rem] gap-1.5">
                <Input aria-label="Nome da coluna" className="h-8 text-xs" value={c.name} onChange={(e) => patchCol(c.id, { name: e.target.value })} />
                <SqlTypeCombobox value={c.type} onChange={(type) => patchCol(c.id, { type })} />
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <CheckField label="PK" title="Chave primária" checked={!!c.pk} onChange={(v) => patchCol(c.id, { pk: v, ...(v ? { nullable: false } : {}) })} />
                <CheckField label="FK" title="Chave estrangeira" checked={!!c.fk} onChange={(v) => patchCol(c.id, { fk: v })} />
                <CheckField label="UQ" title="Único" checked={!!c.unique} onChange={(v) => patchCol(c.id, { unique: v })} />
                <CheckField label="NN" title="Não nulo" checked={c.nullable === false} onChange={(v) => patchCol(c.id, { nullable: !v })} />
                <span className="ml-auto flex">
                  <IconButton title="Subir" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                  <IconButton title="Descer" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                  <IconButton title="Remover coluna" danger onClick={() => setCols(d.columns.filter((x) => x.id !== c.id))}><X className="h-3.5 w-3.5" /></IconButton>
                </span>
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="btn w-full justify-center" onClick={() => setCols([...d.columns, newColumn()])}>
          <Plus className="h-4 w-4" /> Coluna
        </button>
        <FieldDescription className="text-xs">Arraste da bolinha de uma coluna até outra tabela para criar um relacionamento.</FieldDescription>
      </Field>
    </Section>
  );
}

function EdgePanel({ edge }: { edge: Edge }) {
  const { updateEdge, updateEdgeData } = useBoard();
  const isEr = edge.type === 'erRelation';
  const color = (edge.style?.stroke as string) ?? '#8a8473';
  return (
    <div>
      <Section title={isEr ? 'Relacionamento' : 'Conector'}>
        <TextField label="Rótulo" value={(edge.label as string) ?? ''} placeholder="Ex.: Sim / Não" onChange={(label) => updateEdge(edge.id, { label })} />
        {isEr ? (
          <SelectField
            label="Cardinalidade (origem : destino)"
            value={(edge.data as any)?.cardinality ?? 'N:1'}
            options={[['1:1', '1 : 1'], ['1:N', '1 : N'], ['N:1', 'N : 1'], ['N:N', 'N : N']]}
            onChange={(cardinality) => updateEdgeData(edge.id, { cardinality })}
          />
        ) : (
          <>
            <SelectField
              label="Tipo de linha"
              value={edge.type ?? 'default'}
              options={[['smoothstep', 'Ortogonal'], ['straight', 'Reta'], ['default', 'Curva']]}
              onChange={(type) => updateEdge(edge.id, { type })}
            />
            <ColorField
              label="Cor"
              value={color}
              allowTransparent={false}
              onChange={(stroke) => updateEdge(edge.id, { style: { ...edge.style, stroke }, markerEnd: edge.markerEnd ? { type: MarkerType.ArrowClosed, color: stroke } : undefined })}
            />
            <CheckField
              label="Seta no destino"
              checked={!!edge.markerEnd}
              onChange={(v) => updateEdge(edge.id, { markerEnd: v ? { type: MarkerType.ArrowClosed, color } : undefined })}
            />
            <CheckField label="Tracejado animado" checked={!!edge.animated} onChange={(v) => updateEdge(edge.id, { animated: v })} />
          </>
        )}
      </Section>
      <RightClickHint />
    </div>
  );
}
