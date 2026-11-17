'use client';

import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const GROUPS: { title: string; items: [string[], string][] }[] = [
  {
    title: 'Inserir blocos',
    items: [
      [['R'], 'Processo'],
      [['D'], 'Decisão'],
      [['T'], 'Texto livre'],
      [['E'], 'Tabela ER'],
      [['N'], 'Sticky note'],
      [['M'], 'Bloco Markdown'],
      [['K'], 'Bloco de código'],
      [['Ctrl', 'V'], 'Colar imagem da área de transferência'],
    ],
  },
  {
    title: 'Editar',
    items: [
      [['Ctrl', 'Z'], 'Desfazer'],
      [['Ctrl', 'Y'], 'Refazer (ou Ctrl+Shift+Z)'],
      [['Ctrl', 'C'], 'Copiar seleção (vale entre boards e abas)'],
      [['Ctrl', 'X'], 'Recortar seleção'],
      [['Ctrl', 'V'], 'Colar onde está o mouse'],
      [['Ctrl', 'D'], 'Duplicar seleção'],
      [['Ctrl', 'A'], 'Selecionar tudo'],
      [['Ctrl', 'G'], 'Agrupar'],
      [['Ctrl', 'Shift', 'G'], 'Desagrupar'],
      [['Del'], 'Excluir seleção (ou Backspace)'],
    ],
  },
  {
    title: 'Canvas',
    items: [
      [['Ctrl', '0'], 'Ajustar à tela'],
      [['Roda do mouse'], 'Zoom'],
      [['Espaço', 'arrastar'], 'Mover o canvas'],
      [['Shift', 'arrastar'], 'Selecionar por área'],
      [['Shift', 'clique'], 'Adicionar à seleção'],
      [['Botão direito'], 'Menu do bloco / da linha / do canvas'],
    ],
  },
  {
    title: 'Textos',
    items: [
      [['Duplo clique'], 'Editar texto do bloco'],
      [['Enter'], 'Confirmar (campos de uma linha)'],
      [['Ctrl', 'Enter'], 'Confirmar (textos de várias linhas)'],
      [['Esc'], 'Cancelar edição'],
      [['Shift', 'Alt', 'F'], 'Formatar bloco de código'],
      [['Shift', 'Tab'], 'Recuar linhas no bloco de código'],
    ],
  },
  {
    title: 'Linhas',
    items: [
      [['Arrastar linha'], 'Mover o trecho do meio'],
      [['Duplo clique'], 'Voltar a linha ao traçado automático'],
      [['Arrastar ponta'], 'Ligar a outro ponto de conexão'],
    ],
  },
  {
    title: 'Boards',
    items: [
      [['F2'], 'Renomear board selecionado na lista'],
      [['Duplo clique'], 'Renomear board'],
      [['Arrastar ⋮⋮'], 'Reordenar boards'],
      [['?'], 'Abrir esta lista de atalhos'],
    ],
  },
];

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span className="text-[10px] text-muted-foreground">+</span>}
          <kbd className="rounded-md border border-line border-b-2 bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">{k}</kbd>
        </span>
      ))}
    </span>
  );
}

/** Botão "Info" do header + diálogo com todos os atalhos do editor. */
export default function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button className="btn-ghost !px-2" title="Atalhos e ajuda (?)" aria-label="Atalhos e ajuda">
          <Info className="h-[18px] w-[18px]" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Atalhos do editor</DialogTitle>
          <DialogDescription>
            No Mac, use <kbd className="font-mono">⌘</kbd> no lugar de <kbd className="font-mono">Ctrl</kbd>. Os atalhos de uma tecla não funcionam enquanto você digita num campo.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="eyebrow mb-2">{g.title}</h3>
              <ul className="divide-y divide-line">
                {g.items.map(([keys, label]) => (
                  <li key={label} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="text-ink-soft">{label}</span>
                    <Keys keys={keys} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
