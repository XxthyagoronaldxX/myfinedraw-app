'use client';

import { ArrowDown, ArrowUp, Copy, GripVertical, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { api, Asset, assetUrl, BoardSummary } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DND_ASSET } from './factory';
import { Plus } from './icons';

interface Props {
  open: boolean;
  projectId: string;
  boardId: string;
  boards: BoardSummary[];
  assets: Asset[];
  onBoardsChange: () => void;
  onAssetsChange: () => void;
  onInsertAsset: (a: Asset) => void;
}

type PendingDelete = { kind: 'board'; board: BoardSummary } | { kind: 'asset'; asset: Asset } | null;

/** Campo de texto inline: Enter confirma, Esc cancela, sair do campo confirma. */
function InlineName({ initial, onSubmit, onCancel, placeholder }: { initial: string; onSubmit: (v: string) => void; onCancel: () => void; placeholder?: string }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const v = value.trim();
    if (save && v) onSubmit(v);
    else onCancel();
  };
  return (
    <Input
      autoFocus
      aria-label="Nome do board"
      placeholder={placeholder}
      className="h-8 text-sm"
      value={value}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish(true);
        if (e.key === 'Escape') finish(false);
      }}
    />
  );
}

export default function Sidebar({ open, projectId, boardId, boards, assets, onBoardsChange, onAssetsChange, onInsertAsset }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(boards);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  useEffect(() => setOrder(boards), [boards]);

  /* ---------- ações ---------- */
  async function create(name: string) {
    setCreating(false);
    const b = await api<BoardSummary>(`/projects/${projectId}/boards`, { method: 'POST', json: { name } });
    onBoardsChange();
    router.push(`/p/${projectId}/${b.id}`);
  }

  async function rename(b: BoardSummary, name: string) {
    setRenaming(null);
    if (name === b.name) return;
    setOrder((o) => o.map((x) => (x.id === b.id ? { ...x, name } : x)));
    await api(`/boards/${b.id}`, { method: 'PATCH', json: { name } });
    onBoardsChange();
  }

  async function duplicate(b: BoardSummary) {
    const copy = await api<BoardSummary>(`/boards/${b.id}/duplicate`, { method: 'POST' });
    onBoardsChange();
    router.push(`/p/${projectId}/${copy.id}`);
  }

  /** Persiste uma nova ordem (atualiza a tela na hora e só envia o que mudou). */
  async function persistOrder(next: BoardSummary[]) {
    setOrder(next);
    await Promise.all(
      next.map((b, position) => (b.position !== position ? api(`/boards/${b.id}`, { method: 'PATCH', json: { position } }) : null)),
    );
    onBoardsChange();
  }

  function move(id: string, to: number) {
    const from = order.findIndex((b) => b.id === id);
    if (from < 0 || to < 0 || to > order.length) return;
    const next = [...order];
    const [item] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, item);
    if (next.some((b, i) => b.id !== order[i].id)) persistOrder(next);
  }

  async function confirmDelete() {
    const p = pendingDelete;
    setPendingDelete(null);
    if (!p) return;
    if (p.kind === 'board') {
      await api(`/boards/${p.board.id}`, { method: 'DELETE' });
      onBoardsChange();
      if (p.board.id === boardId) router.push(`/p/${projectId}`);
    } else {
      await api(`/assets/${p.asset.id}`, { method: 'DELETE' });
      onAssetsChange();
    }
  }

  /* ---------- menu de ações (mesmos itens no "⋯" e no botão direito) ---------- */
  function actions(b: BoardSummary, i: number) {
    return [
      { key: 'rename', icon: <Pencil />, label: 'Renomear', shortcut: 'F2', run: () => setRenaming(b.id) },
      { key: 'dup', icon: <Copy />, label: 'Duplicar', run: () => duplicate(b) },
      'sep',
      { key: 'up', icon: <ArrowUp />, label: 'Mover para cima', disabled: i === 0, run: () => move(b.id, i - 1) },
      { key: 'down', icon: <ArrowDown />, label: 'Mover para baixo', disabled: i === order.length - 1, run: () => move(b.id, i + 2) },
      'sep',
      { key: 'del', icon: <Trash2 />, label: 'Excluir', destructive: true, disabled: order.length === 1, run: () => setPendingDelete({ kind: 'board', board: b }) },
    ] as const;
  }

  return (
    <aside
      aria-hidden={!open}
      className={`shrink-0 overflow-hidden bg-surface transition-[width] duration-300 ease-out ${open ? 'w-64 border-r border-line' : 'w-0'}`}
    >
      <div className="flex h-full w-64 flex-col">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="eyebrow">
            Boards <span className="ml-1 opacity-60">{order.length}</span>
          </span>
          <button
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-brand"
            onClick={() => setCreating(true)}
            title="Novo board"
            aria-label="Novo board"
          >
            <Plus />
          </button>
        </div>

        <ul className="max-h-[45%] overflow-auto px-2 pb-1" onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropIndex(null)}>
          {order.map((b, i) => {
            const active = b.id === boardId;
            const items = actions(b, i);
            return (
              <li
                key={b.id}
                className="relative"
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  setDropIndex(e.clientY < r.top + r.height / 2 ? i : i + 1);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragId && dropIndex !== null) move(dragId, dropIndex);
                  setDragId(null);
                  setDropIndex(null);
                }}
              >
                {/* indicador de onde o board vai cair */}
                {dropIndex === i && <span className="absolute -top-px left-2 right-2 z-10 h-0.5 rounded bg-brand" />}
                {dropIndex === i + 1 && i === order.length - 1 && <span className="absolute -bottom-px left-2 right-2 z-10 h-0.5 rounded bg-brand" />}

                {renaming === b.id ? (
                  <div className="py-0.5">
                    <InlineName initial={b.name} onSubmit={(name) => rename(b, name)} onCancel={() => setRenaming(null)} />
                  </div>
                ) : (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDragId(b.id);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', b.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropIndex(null);
                        }}
                        onKeyDown={(e) => e.key === 'F2' && setRenaming(b.id)}
                        className={cn(
                          'group relative my-0.5 flex items-center rounded-lg text-sm transition',
                          active ? 'bg-brand-soft font-semibold text-brand-ink' : 'text-ink-soft hover:bg-surface-2',
                          dragId === b.id && 'opacity-40',
                        )}
                      >
                        {active && <span className="absolute -left-2 bottom-1.5 top-1.5 w-[3px] rounded-r bg-brand" />}
                        <span className="flex w-5 shrink-0 cursor-grab justify-center text-muted opacity-0 transition group-hover:opacity-100 active:cursor-grabbing" title="Arraste para reordenar">
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <Link
                          href={`/p/${projectId}/${b.id}`}
                          draggable={false}
                          className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-1"
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setRenaming(b.id);
                          }}
                          title="Duplo clique para renomear"
                        >
                          <span className="font-mono text-[10px] opacity-50">{String(i + 1).padStart(2, '0')}</span>
                          <span className="truncate">{b.name}</span>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                              aria-label={`Ações do board ${b.name}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" side="right" className="w-52">
                            {items.map((it, k) =>
                              it === 'sep' ? (
                                <DropdownMenuSeparator key={k} />
                              ) : (
                                <DropdownMenuItem key={it.key} disabled={'disabled' in it && it.disabled} variant={'destructive' in it ? 'destructive' : 'default'} onSelect={it.run}>
                                  {it.icon} {it.label}
                                  {'shortcut' in it && <DropdownMenuShortcut>{it.shortcut}</DropdownMenuShortcut>}
                                </DropdownMenuItem>
                              ),
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-52">
                      {items.map((it, k) =>
                        it === 'sep' ? (
                          <ContextMenuSeparator key={k} />
                        ) : (
                          <ContextMenuItem key={it.key} disabled={'disabled' in it && it.disabled} variant={'destructive' in it ? 'destructive' : 'default'} onSelect={it.run}>
                            {it.icon} {it.label}
                            {'shortcut' in it && <ContextMenuShortcut>{it.shortcut}</ContextMenuShortcut>}
                          </ContextMenuItem>
                        ),
                      )}
                    </ContextMenuContent>
                  </ContextMenu>
                )}
              </li>
            );
          })}

          {creating && (
            <li className="py-0.5">
              <InlineName initial={`Board ${order.length + 1}`} onSubmit={create} onCancel={() => setCreating(false)} />
            </li>
          )}
        </ul>

        <div className="eyebrow mx-4 mt-4 border-t border-line pb-1 pt-4">Imagens do projeto</div>
        <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-auto p-3">
          {assets.length === 0 && (
            <p className="col-span-2 rounded-lg border border-dashed border-line-strong p-3 text-center text-xs leading-relaxed text-muted">
              Envie, arraste ou cole <kbd className="font-mono">Ctrl+V</kbd> imagens no canvas.
            </p>
          )}
          {assets.map((a) => (
            <div key={a.id} className="group relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-2 transition hover:border-brand">
              <img
                src={assetUrl(a.url)}
                alt={a.fileName}
                className="h-full w-full cursor-grab object-cover active:cursor-grabbing"
                title="Clique ou arraste para o canvas"
                onClick={() => onInsertAsset(a)}
                draggable
                onDragStart={(e) => {
                  const img = e.currentTarget;
                  e.dataTransfer.setData(DND_ASSET, JSON.stringify({ asset: a, w: img.naturalWidth, h: img.naturalHeight }));
                  e.dataTransfer.effectAllowed = 'copy';
                }}
              />
              <button
                className="absolute right-1 top-1 hidden h-6 w-6 items-center justify-center rounded-md bg-surface/90 text-muted shadow-soft hover:text-destructive group-hover:flex"
                onClick={() => setPendingDelete({ kind: 'asset', asset: a })}
                title="Excluir imagem"
                aria-label={`Excluir imagem ${a.fileName}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === 'board' ? `Excluir o board "${pendingDelete.board.name}"?` : 'Excluir esta imagem?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === 'board'
                ? 'Todo o conteúdo deste board (tabelas, fluxos, notas e imagens no canvas) será apagado. Essa ação não pode ser desfeita.'
                : `"${pendingDelete?.kind === 'asset' ? pendingDelete.asset.fileName : ''}" sai da galeria e deixa de aparecer nos boards que a usam. Essa ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
