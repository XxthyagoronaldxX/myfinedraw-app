'use client';

import { ArrowDownToLine, ArrowUpToLine, ClipboardPaste, Copy, CopyPlus, Group, Maximize, MousePointer2, Trash2, Ungroup } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { useBoard } from './store';

export type MenuTarget = { kind: 'node'; id: string } | { kind: 'edge'; id: string } | { kind: 'pane' };

const NODE_LABELS: Record<string, string> = {
  flow: 'Forma',
  erTable: 'Tabela',
  sticky: 'Nota',
  markdown: 'Markdown',
  code: 'Bloco de código',
  image: 'Imagem',
  group: 'Grupo',
};

interface Props {
  target: MenuTarget;
  canPaste: boolean;
  onCopy: () => void;
  onDuplicate: () => void;
  onPaste: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onSelectAll: () => void;
  onFit: () => void;
  children: React.ReactNode;
}

/** Menu de contexto (botão direito) do canvas: organiza blocos, conectores e a área vazia. */
export default function CanvasMenu({ target, canPaste, onCopy, onDuplicate, onPaste, onGroup, onUngroup, onSelectAll, onFit, children }: Props) {
  const nodes = useBoard((s) => s.nodes);
  const { updateNode, deleteSelected } = useBoard.getState();

  const node = target.kind === 'node' ? nodes.find((n) => n.id === target.id) : undefined;
  const selected = nodes.filter((n) => n.selected);
  const zs = nodes.map((n) => n.zIndex ?? 0);
  const canGroup = selected.filter((n) => !n.parentId).length > 1;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {target.kind === 'node' && node && (
          <>
            <ContextMenuLabel className="eyebrow">
              {selected.length > 1 ? `${selected.length} itens selecionados` : NODE_LABELS[node.type ?? ''] ?? 'Bloco'}
            </ContextMenuLabel>
            <ContextMenuItem onSelect={() => updateNode(node.id, { zIndex: Math.max(...zs) + 1 })}>
              <ArrowUpToLine /> Trazer para frente
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => updateNode(node.id, { zIndex: Math.min(...zs) - 1 })}>
              <ArrowDownToLine /> Enviar para trás
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={onCopy}>
              <Copy /> Copiar <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={onDuplicate}>
              <CopyPlus /> Duplicar <ContextMenuShortcut>Ctrl+D</ContextMenuShortcut>
            </ContextMenuItem>
            {canGroup && (
              <ContextMenuItem onSelect={onGroup}>
                <Group /> Agrupar <ContextMenuShortcut>Ctrl+G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            {node.type === 'group' && (
              <ContextMenuItem onSelect={onUngroup}>
                <Ungroup /> Desagrupar <ContextMenuShortcut>Ctrl+⇧+G</ContextMenuShortcut>
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={deleteSelected}>
              <Trash2 /> Excluir <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {target.kind === 'edge' && (
          <>
            <ContextMenuLabel className="eyebrow">Conector</ContextMenuLabel>
            <ContextMenuItem variant="destructive" onSelect={deleteSelected}>
              <Trash2 /> Excluir <ContextMenuShortcut>Del</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}

        {(target.kind === 'pane' || (target.kind === 'node' && !node)) && (
          <>
            <ContextMenuLabel className="eyebrow">Canvas</ContextMenuLabel>
            <ContextMenuItem disabled={!canPaste} onSelect={onPaste}>
              <ClipboardPaste /> Colar <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={onSelectAll}>
              <MousePointer2 /> Selecionar tudo <ContextMenuShortcut>Ctrl+A</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={onFit}>
              <Maximize /> Ajustar à tela <ContextMenuShortcut>Ctrl+0</ContextMenuShortcut>
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
