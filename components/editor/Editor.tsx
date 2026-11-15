'use client';

import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Edge,
  getViewportForBounds,
  Node,
  NodeChange,
  NodePositionChange,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Viewport,
  XYPosition,
} from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, Asset, Board, BoardSummary, uploadImage } from '@/lib/api';
import { ThemeToggle, useTheme } from '@/lib/theme';
import Logo from '../Logo';
import * as I from './icons';
import CanvasMenu, { MenuTarget } from './CanvasMenu';
import ShortcutsDialog from './ShortcutsDialog';
import { GuideLines, Guides, snapToNodes } from './snap';
import { handleFor, projectAnchor } from './edgeGeometry';
import { Textarea } from '@/components/ui/textarea';
import { edgeTypes, ErMarkers } from './edges';
import {
  createFlowNode,
  createImageNode,
  createMarkdownNode,
  createStickyNode,
  createTableNode,
  DND_ASSET,
  DND_TOOL,
  FlowShape,
} from './factory';
import { nodeTypes } from './nodes';
import PropertiesPanel from './PropertiesPanel';
import Sidebar from './Sidebar';
import { serialize, useBoard } from './store';

type SaveState ='saved' | 'pending' | 'saving' | 'error' | 'conflict';

/** Prefixo do conteúdo copiado na área de transferência do sistema (texto JSON). */
const MFD_CLIPBOARD = 'MYFINEDRAW_CLIPBOARD_V1:';

export default function Editor(props: { projectId: string; boardId: string }) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}

function download(name: string, href: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
}

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  t.dataset.mfdClipboard === undefined && // o campo oculto do copiar/colar não conta como digitação
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

function imageSize(file: File): Promise<{ w: number; h: number } | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => resolve(undefined);
    img.src = URL.createObjectURL(file);
  });
}

function EditorInner({ projectId, boardId }: { projectId: string; boardId: string }) {
  const rf = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, onReconnect, version, edgeType, setEdgeType } = useBoard();

  const [board, setBoard] = useState<Board | null>(null);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [save, setSave] = useState<SaveState>('saved');
  const [snap, setSnap] = useState(true);
  const [alignSnap, setAlignSnap] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dropHint, setDropHint] = useState(false);
  const hasSelection = nodes.some((n) => n.selected) || edges.some((e) => e.selected);
  // linhas livres têm alças próprias nas pontas; o "reconnect" do React Flow fica só para as ER
  const displayEdges = useMemo(
    () => edges.map((e) => (e.type === 'erRelation' || e.reconnectable === false ? e : { ...e, reconnectable: false })),
    [edges],
  );
  const [guides, setGuides] = useState<Guides>({});

  // lembra a preferência de alinhamento entre sessões
  useEffect(() => {
    try {
      if (localStorage.getItem('mfd.align') === '0') setAlignSnap(false);
    } catch {}
  }, []);
  const toggleAlign = () =>
    setAlignSnap((v) => {
      try {
        localStorage.setItem('mfd.align', v ? '0' : '1');
      } catch {}
      return !v;
    });

  /** Aplica o snap de alinhamento ao bloco arrastado antes de repassar ao store. */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const pos = changes.length === 1 && changes[0].type === 'position' ? (changes[0] as NodePositionChange) : null;
      if (pos?.dragging && pos.position && alignSnap) {
        setGuides(snapToNodes(pos, useBoard.getState().nodes, 6 / rf.getZoom()));
      } else if (pos && !pos.dragging) {
        setGuides({});
      }
      onNodesChange(changes);
    },
    [alignSnap, onNodesChange, rf],
  );
  const [sql, setSql] = useState<null | { mode: 'import' | 'export'; text: string }>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const { theme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // lembra se o painel lateral estava aberto
  useEffect(() => {
    try {
      if (localStorage.getItem('mfd.sidebar') === '0') setSidebarOpen(false);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('mfd.sidebar', sidebarOpen ? '1' : '0');
    } catch {}
  }, [sidebarOpen]);

  const baseUpdatedAt = useRef<string | undefined>(undefined);
  const viewport = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const loadedVersion = useRef(-1);
  const clipboard = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [menuTarget, setMenuTarget] = useState<MenuTarget>({ kind: 'pane' });
  const [loadError, setLoadError] = useState<string | null>(null);

  /* ---------- carregar ---------- */
  const loadBoards = useCallback(() => api<BoardSummary[]>(`/projects/${projectId}/boards`).then(setBoards), [projectId]);
  const loadAssets = useCallback(() => api<Asset[]>(`/projects/${projectId}/assets`).then(setAssets), [projectId]);

  useEffect(() => {
    api<Board>(`/boards/${boardId}`).then((b) => {
      setBoard(b);
      baseUpdatedAt.current = b.updatedAt;
      viewport.current = b.content.viewport ?? viewport.current;
      useBoard.getState().load(b.content.nodes ?? [], b.content.edges ?? []);
      loadedVersion.current = 0;
      setSave('saved');
      setTimeout(() => (b.content.nodes?.length ? rf.setViewport(viewport.current) : rf.fitView()));
    }).catch((e) => {
      // sem acesso ou board inexistente: não mostrar um canvas vazio que pareça editável
      loadedVersion.current = -1;
      setLoadError(
        e instanceof ApiError && e.status === 403
          ? 'Este board pertence a outra conta. Entre com a conta dona do projeto para abri-lo.'
          : e instanceof ApiError && e.status === 404
            ? 'Board não encontrado.'
            : `Não foi possível abrir o board: ${e.message}`,
      );
    });
    loadBoards();
    loadAssets();
  }, [boardId, loadBoards, loadAssets, rf]);

  /* ---------- autosave ---------- */
  const doSave = useCallback(async () => {
    const { nodes, edges } = useBoard.getState();
    setSave('saving');
    try {
      const res = await api<{ updatedAt: string }>(`/boards/${boardId}/content`, {
        method: 'PUT',
        json: { content: { version: 1, viewport: viewport.current, ...serialize(nodes, edges) }, baseUpdatedAt: baseUpdatedAt.current },
      });
      baseUpdatedAt.current = res.updatedAt;
      setSave((s) => (s === 'saving' ? 'saved' : s));
    } catch (e) {
      setSave(e instanceof ApiError && e.status === 409 ? 'conflict' : 'error');
    }
  }, [boardId]);

  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (loadedVersion.current < 0 || version === loadedVersion.current) return;
    if (save === 'conflict') return;
    setSave('pending');
    if (pendingSave.current) clearTimeout(pendingSave.current);
    pendingSave.current = setTimeout(() => {
      pendingSave.current = null;
      doSave();
    }, 1000);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  // salva imediatamente ao sair do board
  useEffect(
    () => () => {
      if (pendingSave.current) {
        clearTimeout(pendingSave.current);
        doSave();
      }
    },
    [doSave],
  );

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (save === 'pending' || save === 'saving') e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [save]);

  /* ---------- inserir elementos ---------- */
  const center = useCallback(() => {
    const r = wrapper.current!.getBoundingClientRect();
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [rf]);

  const add = useCallback((n: Node) => useBoard.getState().addElements([n]), []);

  const insertAsset = useCallback(
    (a: Asset, pos = center(), natural?: { w: number; h: number }) => add(createImageNode(pos, a, natural)),
    [add, center],
  );

  const uploadFiles = useCallback(
    async (files: File[], pos = center()) => {
      for (const [i, f] of files.filter((f) => f.type.startsWith('image/')).entries()) {
        try {
          const [asset, size] = await Promise.all([uploadImage(projectId, f), imageSize(f)]);
          insertAsset(asset, { x: pos.x + i * 30, y: pos.y + i * 30 }, size);
        } catch (e: any) {
          alert(`Falha ao enviar ${f.name}: ${e.message}`);
        }
      }
      loadAssets();
    },
    [projectId, center, insertAsset, loadAssets],
  );

  /* ---------- copiar / colar / agrupar ---------- */
  /** Última posição do mouse sobre o canvas (coordenadas de tela), usada para colar no lugar certo. */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  /** Onde o menu de botão direito foi aberto (o "Colar" do menu cola ali). */
  const menuPoint = useRef<{ x: number; y: number } | null>(null);
  /** Campo oculto que recebe o foco no Ctrl+C/V para o navegador disparar copy/paste nativos. */
  const clipboardField = useRef<HTMLTextAreaElement>(null);

  /** Copia a seleção para a memória; devolve o texto para a área de transferência (ou false). */
  const copy = useCallback((writeSystemClipboard = true): string | false => {
    const { nodes, edges } = useBoard.getState();
    const sel = nodes.filter((n) => n.selected);
    if (!sel.length) return false;
    const ids = new Set(sel.map((n) => n.id));
    // inclui filhos de grupos selecionados
    nodes.forEach((n) => n.parentId && ids.has(n.parentId) && !ids.has(n.id) && (sel.push(n), ids.add(n.id)));
    const clip = {
      nodes: structuredClone(sel).map((n) => ({ ...n, selected: false })),
      edges: structuredClone(edges.filter((e) => ids.has(e.source) && ids.has(e.target))).map((e) => ({ ...e, selected: false })),
    };
    clipboard.current = clip;
    const payload = MFD_CLIPBOARD + JSON.stringify(clip);
    // fora do atalho de teclado (ex.: menu "Copiar"), grava pela API assíncrona
    if (writeSystemClipboard) navigator.clipboard?.writeText(payload).catch(() => undefined);
    return payload;
  }, []);

  /** Cola o conteúdo copiado; com `at`, o conjunto fica centralizado nesse ponto (coordenadas de tela). */
  const paste = useCallback(
    (at?: { x: number; y: number } | null) => {
      const clip = clipboard.current;
      if (!clip?.nodes.length) return;
      const map = new Map(clip.nodes.map((n) => [n.id, crypto.randomUUID()]));

      // deslocamento: para o ponteiro do mouse, ou +30px se o mouse não está no canvas
      let dx = 30;
      let dy = 30;
      if (at) {
        const tops = clip.nodes.filter((n) => !n.parentId || !map.has(n.parentId));
        const xs = tops.flatMap((n) => [n.position.x, n.position.x + (n.measured?.width ?? n.width ?? 0)]);
        const ys = tops.flatMap((n) => [n.position.y, n.position.y + (n.measured?.height ?? n.height ?? 0)]);
        const target = rf.screenToFlowPosition(at);
        dx = target.x - (Math.min(...xs) + Math.max(...xs)) / 2;
        dy = target.y - (Math.min(...ys) + Math.max(...ys)) / 2;
      }

      const nodes = clip.nodes.map((n) => ({
        ...structuredClone(n),
        id: map.get(n.id)!,
        parentId: n.parentId ? map.get(n.parentId) ?? undefined : undefined,
        position: n.parentId && map.has(n.parentId) ? n.position : { x: Math.round(n.position.x + dx), y: Math.round(n.position.y + dy) },
      }));
      const edges = clip.edges.map((e) => ({ ...structuredClone(e), id: crypto.randomUUID(), source: map.get(e.source)!, target: map.get(e.target)!, selected: false }));
      useBoard.getState().addElements(nodes, edges);
      // colar de novo (sem mover o mouse) empilha a próxima cópia ao lado desta
      clipboard.current = { nodes: nodes.map((n) => ({ ...n, selected: false })), edges };
    },
    [rf],
  );

  /** Lê conteúdo do MyFineDraw de um texto da área de transferência. */
  const loadClipboardText = useCallback((text: string | undefined) => {
    if (!text?.startsWith(MFD_CLIPBOARD)) return false;
    try {
      const clip = JSON.parse(text.slice(MFD_CLIPBOARD.length));
      if (!Array.isArray(clip.nodes) || !Array.isArray(clip.edges)) return false;
      // se for o mesmo conteúdo copiado aqui, mantém o deslocamento acumulado do colar anterior
      if (clipboard.current && JSON.stringify(clipboard.current.nodes.map((n) => n.data)) === JSON.stringify(clip.nodes.map((n: Node) => n.data))) return true;
      clipboard.current = clip;
      return true;
    } catch {
      return false;
    }
  }, []);

  const group = useCallback(() => {
    const sel = useBoard.getState().nodes.filter((n) => n.selected && !n.parentId);
    if (sel.length < 2) return;
    const b = rf.getNodesBounds(sel);
    const pad = 20;
    const g: Node = {
      id: crypto.randomUUID(),
      type: 'group',
      position: { x: b.x - pad, y: b.y - pad },
      width: b.width + pad * 2,
      height: b.height + pad * 2,
      data: {},
      selected: true,
      style: { background: 'rgba(99,102,241,0.04)', border: '1px dashed #a5b4fc', borderRadius: 8 },
    };
    const ids = new Set(sel.map((n) => n.id));
    useBoard.getState().setNodes((nodes) => [
      g,
      ...nodes
        .filter((n) => !ids.has(n.id))
        .map((n) => ({ ...n, selected: false })),
      ...sel.map((n) => ({ ...n, selected: false, parentId: g.id, position: { x: n.position.x - g.position.x, y: n.position.y - g.position.y } })),
    ]);
  }, [rf]);

  const ungroup = useCallback(() => {
    const groups = useBoard.getState().nodes.filter((n) => n.selected && n.type === 'group');
    if (!groups.length) return;
    const gmap = new Map(groups.map((g) => [g.id, g]));
    useBoard.getState().setNodes((nodes) =>
      nodes
        .filter((n) => !gmap.has(n.id))
        .map((n) => {
          const g = n.parentId ? gmap.get(n.parentId) : undefined;
          return g ? { ...n, parentId: undefined, position: { x: n.position.x + g.position.x, y: n.position.y + g.position.y } } : n;
        }),
    );
  }, []);

  /* ---------- atalhos ---------- */
  useEffect(() => {
    const flow = (s: FlowShape) => () => add(createFlowNode(s, center()));
    const keys: Record<string, () => void> = {
      r: flow('process'),
      d: flow('decision'),
      t: flow('text'),
      e: () => add(createTableNode(center())),
      n: () => add(createStickyNode(center())),
      m: () => add(createMarkdownNode(center())),
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      const s = useBoard.getState();
      if (mod && k === 'z' && !e.shiftKey) return e.preventDefault(), s.undo();
      if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) return e.preventDefault(), s.redo();
      // Ctrl+C / Ctrl+X / Ctrl+V: o foco vai por um instante para um campo oculto, assim o
      // navegador dispara os eventos nativos "copy"/"paste" — que leem e gravam a área de
      // transferência do sistema SEM pedir permissão (funciona entre abas e janelas).
      if (mod && (k === 'c' || k === 'x')) {
        if (!s.nodes.some((n) => n.selected)) return;
        cutAfterCopy = k === 'x';
        pendingCopy = true;
        armClipboardField(true);
        // rede de segurança: se o "copy" nativo não vier, copia pela API e devolve o foco
        setTimeout(() => {
          if (!pendingCopy) return;
          pendingCopy = false;
          restoreFocus();
          if (copy() && cutAfterCopy) useBoard.getState().deleteSelected();
          cutAfterCopy = false;
        }, 150);
        return; // não chama preventDefault: o navegador precisa executar o copiar
      }
      if (mod && k === 'd') return e.preventDefault(), copy() && paste();
      if (mod && k === 'v') {
        pendingPaste = true;
        armClipboardField(false);
        // rede de segurança: se o navegador não disparar "paste", usa a cópia interna
        setTimeout(() => {
          if (!pendingPaste) return;
          pendingPaste = false;
          restoreFocus();
          paste(pointer.current);
        }, 150);
        return;
      }
      if (mod && k === 'g') return e.preventDefault(), e.shiftKey ? ungroup() : group();
      if (mod && k === '0') return e.preventDefault(), rf.fitView({ duration: 200 });
      if (mod && k === 'a') return e.preventDefault(), rf.setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
      if (e.key === '?') return e.preventDefault(), setHelpOpen(true);
      if (!mod && !e.altKey && keys[k]) return e.preventDefault(), keys[k]();
    };
    let pendingPaste = false;
    let pendingCopy = false;
    let cutAfterCopy = false;
    let returnFocus: HTMLElement | null = null;

    /** Foca o campo oculto; para copiar, deixa um texto selecionado (o navegador exige seleção). */
    const armClipboardField = (forCopy: boolean) => {
      const field = clipboardField.current;
      if (!field) return;
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      field.value = forCopy ? ' ' : '';
      field.focus({ preventScroll: true });
      if (forCopy) field.select();
    };
    const restoreFocus = () => {
      clipboardField.current?.blur();
      returnFocus?.focus?.({ preventScroll: true });
      returnFocus = null;
    };
    const fromOurField = (t: EventTarget | null) => t === clipboardField.current;

    // "copy" nativo: grava os blocos selecionados como texto na área de transferência do sistema
    const onCopy = (e: ClipboardEvent) => {
      if (isTyping(e.target) && !fromOurField(e.target)) return;
      pendingCopy = false;
      const payload = copy(false);
      if (!payload) return;
      e.preventDefault();
      e.clipboardData?.setData('text/plain', payload);
      if (cutAfterCopy) useBoard.getState().deleteSelected();
      cutAfterCopy = false;
      setTimeout(restoreFocus);
    };

    // "paste" nativo: imagem copiada, blocos do MyFineDraw (de qualquer aba) ou a cópia interna
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target) && !fromOurField(e.target)) return;
      pendingPaste = false;
      e.preventDefault();
      setTimeout(restoreFocus);
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      const at = pointer.current ? rf.screenToFlowPosition(pointer.current) : undefined;
      if (files.length) return void uploadFiles(files, at);
      loadClipboardText(e.clipboardData?.getData('text/plain'));
      paste(pointer.current);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('copy', onCopy);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('paste', onPaste);
    };
  }, [add, center, copy, paste, loadClipboardText, group, ungroup, uploadFiles, rf]);

  /* ---------- exportar ---------- */
  async function exportImage(kind: 'png' | 'svg') {
    setExportOpen(false);
    const all = rf.getNodes();
    if (!all.length) return alert('O board está vazio.');
    const sel = all.filter((n) => n.selected);
    const bounds = rf.getNodesBounds(sel.length ? sel : all);
    const pad = 40;
    const width = Math.ceil(bounds.width + pad * 2);
    const height = Math.ceil(bounds.height + pad * 2);
    const vp = getViewportForBounds(bounds, width, height, 0.1, 2, pad / Math.max(width, height));
    const el = wrapper.current!.querySelector('.react-flow__viewport') as HTMLElement;
    const opts = {
      backgroundColor: '#ffffff',
      width,
      height,
      style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
      filter: (node: HTMLElement) => !node.classList?.contains('react-flow__resize-control'),
    };
    const url = kind === 'png' ? await toPng(el, { ...opts, pixelRatio: 2 }) : await toSvg(el, opts);
    download(`${board?.name ?? 'board'}.${kind}`, url);
  }

  async function exportJson() {
    setExportOpen(false);
    const data = await api(`/projects/${projectId}/export`);
    download(`${board?.projectName ?? 'projeto'}.json`, URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })));
  }

  async function exportSql() {
    setExportOpen(false);
    if (pendingSave.current) {
      clearTimeout(pendingSave.current);
      pendingSave.current = null;
      await doSave();
    }
    const { sql } = await api<{ sql: string }>(`/boards/${boardId}/export/sql`);
    setSql({ mode: 'export', text: sql.trim() || '-- Nenhuma tabela ER neste board' });
  }

  async function importSql() {
    if (!sql?.text.trim()) return;
    try {
      const res = await api<{ nodes: Node[]; edges: Edge[] }>(`/boards/${boardId}/import/sql`, { method: 'POST', json: { sql: sql.text } });
      if (!res.nodes.length) return alert('Nenhum CREATE TABLE encontrado.');
      const c = center();
      const minX = Math.min(...res.nodes.map((n) => n.position.x));
      const minY = Math.min(...res.nodes.map((n) => n.position.y));
      const nodes = res.nodes.map((n) => ({ ...n, width: 260, position: { x: n.position.x - minX + c.x - 300, y: n.position.y - minY + c.y - 150 } }));
      useBoard.getState().addElements(nodes, res.edges);
      setSql(null);
      setTimeout(() => rf.fitView({ duration: 300 }), 50);
    } catch (e: any) {
      alert(e.message);
    }
  }

  const saveLabel: Record<SaveState, string> = {
    saved: 'Salvo ✓',
    pending: 'Alterações pendentes…',
    saving: 'Salvando…',
    error: 'Erro ao salvar — tentar de novo',
    conflict: 'Board alterado em outra aba — recarregue',
  };

  /** Cada ferramenta: clique cria no centro da tela; arrastar cria onde for solto (make). */
  type Tool = { id: string; icon: React.ReactNode; title: string; key?: string; make?: (pos: XYPosition) => Node; run: () => void };
  const tool = (id: string, icon: React.ReactNode, title: string, make: (pos: XYPosition) => Node, key?: string): Tool => ({
    id, icon, title, key, make, run: () => add(make(center())),
  });
  const flow = (s: FlowShape) => (pos: XYPosition) => createFlowNode(s, pos);
  const toolGroups: Tool[][] = [
    [
      tool('terminal', <I.Terminal />, 'Início/Fim', flow('terminal')),
      tool('process', <I.Process />, 'Processo', flow('process'), 'R'),
      tool('decision', <I.Decision />, 'Decisão', flow('decision'), 'D'),
      tool('io', <I.Io />, 'Entrada/Saída', flow('io')),
      tool('document', <I.Doc />, 'Documento', flow('document')),
      tool('subprocess', <I.Sub />, 'Subprocesso', flow('subprocess')),
      tool('text', <I.Text />, 'Texto', flow('text'), 'T'),
    ],
    // UML
    [
      tool('actor', <I.Actor />, 'Ator (UML)', flow('actor')),
      tool('usecase', <I.UseCase />, 'Caso de uso (UML)', flow('usecase')),
    ],
    [tool('table', <I.Table />, 'Tabela ER', createTableNode, 'E')],
    [
      tool('sticky', <I.Sticky />, 'Sticky note', createStickyNode, 'N'),
      tool('markdown', <I.Markdown />, 'Bloco Markdown', createMarkdownNode, 'M'),
      { id: 'image', icon: <I.Image />, title: 'Enviar imagem', run: () => fileInput.current?.click() },
    ],
  ];

  const saveTone = save === 'error' || save === 'conflict' ? 'bg-brand' : save === 'saved' ? 'bg-emerald-500' : 'bg-amber-400 animate-pulse';

  if (loadError)
    return (
      <div className="paper flex h-screen items-center justify-center p-4">
        <div className="max-w-sm rounded-2xl border border-line bg-surface p-6 text-center shadow-soft">
          <p className="font-display text-lg font-semibold text-ink">Não foi possível abrir</p>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
          <Link href="/" className="btn-primary mt-5">Voltar aos projetos</Link>
        </div>
      </div>
    );

  return (
    <div className="flex h-screen flex-col bg-bg">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3">
        <button
          className="btn-ghost !px-2"
          title={sidebarOpen ? 'Esconder painel lateral' : 'Mostrar painel lateral'}
          aria-label="Alternar painel lateral"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          <I.Sidebar open={sidebarOpen} />
        </button>
        <Logo compact />
        <nav className="flex min-w-0 items-center gap-1.5 text-sm">
          <Link href="/" className="truncate text-muted hover:text-ink">{board?.projectName}</Link>
          <span className="text-line-strong">/</span>
          <span className="truncate font-display font-semibold text-ink">{boards.find((b) => b.id === boardId)?.name ?? board?.name}</span>
        </nav>

        <button
          className="ml-auto flex items-center gap-2 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-muted"
          onClick={() => save === 'error' && doSave()}
          title={saveLabel[save]}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${saveTone}`} />
          <span className="hidden md:inline">{saveLabel[save]}</span>
        </button>
        <button
          className={`btn-ghost ${snap ? '!text-brand' : ''}`}
          title={snap ? 'Grade e encaixe na grade: ligado' : 'Grade e encaixe na grade: desligado'}
          aria-pressed={snap}
          onClick={() => setSnap((s) => !s)}
        >
          <I.Grid />
        </button>
        <button
          className={`btn-ghost ${alignSnap ? '!text-brand' : ''}`}
          title={alignSnap ? 'Alinhar com outros blocos: ligado' : 'Alinhar com outros blocos: desligado'}
          aria-pressed={alignSnap}
          onClick={toggleAlign}
        >
          <I.Magnet />
        </button>
        <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
        <ThemeToggle />
        <span className="mx-1 h-6 w-px bg-line" />
        <button className="btn" onClick={() => setSql({ mode: 'import', text: '' })}>
          <I.Db /> <span className="hidden lg:inline">Importar SQL</span>
        </button>
        <div className="relative">
          <button className="btn-primary" onClick={() => setExportOpen((o) => !o)}>
            Exportar <span className="text-[10px] opacity-80">▼</span>
          </button>
          {exportOpen && (
            <div className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 text-sm text-ink shadow-soft">
              {[
                ['PNG', () => exportImage('png')],
                ['SVG', () => exportImage('svg')],
                ['SQL (PostgreSQL)', exportSql],
                ['Projeto em JSON', exportJson],
              ].map(([l, fn]) => (
                <button key={l as string} className="block w-full px-3 py-1.5 text-left hover:bg-surface-2" onClick={fn as () => void}>
                  {l as string}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          projectId={projectId}
          boardId={boardId}
          boards={boards}
          assets={assets}
          onBoardsChange={loadBoards}
          onAssetsChange={loadAssets}
          onInsertAsset={(a) => insertAsset(a)}
        />

        <div
          ref={wrapper}
          className="relative min-w-0 flex-1"
          onPointerMove={(e) => (pointer.current = { x: e.clientX, y: e.clientY })}
          onPointerLeave={() => (pointer.current = null)}
          onDragOver={(e) => {
            e.preventDefault();
            const internal = e.dataTransfer.types.includes(DND_TOOL) || e.dataTransfer.types.includes(DND_ASSET);
            e.dataTransfer.dropEffect = 'copy';
            if (internal && !dropHint) setDropHint(true);
          }}
          onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as globalThis.Node) && setDropHint(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropHint(false);
            const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
            // 1) ferramenta arrastada do dock
            const toolId = e.dataTransfer.getData(DND_TOOL);
            if (toolId) {
              const t = toolGroups.flat().find((x) => x.id === toolId);
              if (t?.make) add(t.make(pos));
              return;
            }
            // 2) imagem arrastada da galeria do projeto
            const assetJson = e.dataTransfer.getData(DND_ASSET);
            if (assetJson) {
              try {
                const { asset, w, h } = JSON.parse(assetJson);
                insertAsset(asset, pos, w && h ? { w, h } : undefined);
              } catch {}
              return;
            }
            // 3) arquivos do computador
            const files = [...e.dataTransfer.files];
            if (files.length) uploadFiles(files, pos);
          }}
        >
          <ErMarkers />
          {/* campo oculto usado pelo Ctrl+C/V (ver armClipboardField) */}
          <textarea
            ref={clipboardField}
            data-mfd-clipboard=""
            aria-hidden
            tabIndex={-1}
            readOnly={false}
            className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
            style={{ transform: 'translateX(-200vw)' }}
          />
          <GuideLines guides={guides} />
          {dropHint && <div className="pointer-events-none absolute inset-2 z-[6] rounded-2xl border-2 border-dashed border-brand/60 bg-brand/5" />}
          {/* dock de ferramentas (vertical, à esquerda do canvas) */}
          <div className="absolute left-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-soft backdrop-blur">
            {toolGroups.map((g, gi) => (
              <div key={gi} className="flex flex-col gap-0.5">
                {gi > 0 && <span className="mx-auto my-1 h-px w-6 bg-line" />}
                {g.map((t) => (
                  <button
                    key={t.title}
                    className={`tool group relative !h-10 !w-10 ${t.make ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onClick={t.run}
                    aria-label={t.title}
                    draggable={!!t.make}
                    onDragStart={(e) => {
                      if (!t.make) return;
                      e.dataTransfer.setData(DND_TOOL, t.id);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    {t.icon}
                    <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-surface shadow-soft group-hover:block">
                      {t.title}
                      {t.key && <kbd className="ml-2 font-mono text-[10px] opacity-60">{t.key}</kbd>}
                      {t.make && <span className="ml-2 opacity-60">· clique ou arraste</span>}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {/* barra inferior: conector, desfazer/refazer */}
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line bg-surface/95 p-1 shadow-soft backdrop-blur">
            {(
              [
                ['smoothstep', 'Ortogonal', <I.EdgeStep key="s" />],
                ['straight', 'Reta', <I.EdgeStraight key="r" />],
                ['default', 'Curva', <I.EdgeCurve key="c" />],
              ] as const
            ).map(([v, l, icon]) => (
              <button
                key={v}
                title={`Conector ${l.toLowerCase()} para novas ligações`}
                onClick={() => setEdgeType(v)}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${edgeType === v ? 'bg-ink text-surface' : 'text-ink-soft hover:bg-surface-2'}`}
              >
                {icon}
                <span className="hidden sm:inline">{l}</span>
              </button>
            ))}
            <span className="mx-1 h-5 w-px bg-line" />
            <button className="tool !h-8 !min-w-8 !rounded-full" title="Desfazer (Ctrl+Z)" onClick={() => useBoard.getState().undo()}><I.Undo /></button>
            <button className="tool !h-8 !min-w-8 !rounded-full" title="Refazer (Ctrl+Y)" onClick={() => useBoard.getState().redo()}><I.Redo /></button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            multiple
            hidden
            onChange={(e) => {
              uploadFiles([...(e.target.files ?? [])]);
              e.target.value = '';
            }}
          />

          <CanvasMenu
            target={menuTarget}
            canPaste
            onCopy={copy}
            onDuplicate={() => copy() && paste()}
            onPaste={async () => {
              try {
                loadClipboardText(await navigator.clipboard.readText());
              } catch {}
              paste(menuPoint.current);
            }}
            onGroup={group}
            onUngroup={ungroup}
            onSelectAll={() => rf.setNodes((ns) => ns.map((n) => ({ ...n, selected: true })))}
            onFit={() => rf.fitView({ duration: 200 })}
          >
          <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={handleNodesChange}
            onNodeDragStop={() => setGuides({})}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectEnd={(event, state) => {
              // soltou fora de um ponto de conexão: se caiu sobre um bloco, liga na borda mais próxima
              if (state.isValid || !state.fromNode) return;
              const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
              const hit = document
                .elementsFromPoint(pt.clientX, pt.clientY)
                .map((el) => el.closest('.react-flow__node'))
                .find((el): el is HTMLElement => !!el && !el.classList.contains('react-flow__node-group'));
              const targetId = hit?.dataset.id;
              if (!targetId || targetId === state.fromNode.id) return;
              const target = rf.getInternalNode(targetId);
              if (!target) return;
              // relacionamentos ER continuam ligando coluna a coluna
              if (state.fromNode.type === 'erTable' && target.type === 'erTable') return;
              const anchor = projectAnchor(target, rf.screenToFlowPosition({ x: pt.clientX, y: pt.clientY }));
              useBoard.getState().connectAnchored({
                source: state.fromNode.id,
                sourceHandle: state.fromHandle?.id ?? null,
                target: targetId,
                targetHandle: target.type === 'erTable' ? null : handleFor(anchor),
                targetAnchor: anchor,
              });
            }}
            onReconnect={onReconnect}
            reconnectRadius={12}
            onNodeContextMenu={(_, n) => {
              setMenuTarget({ kind: 'node', id: n.id });
              // botão direito em um bloco não selecionado passa a selecionar só ele
              if (!n.selected)
                useBoard.setState((s) => ({
                  nodes: s.nodes.map((x) => (x.selected !== (x.id === n.id) ? { ...x, selected: x.id === n.id } : x)),
                  edges: s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)),
                }));
            }}
            onEdgeContextMenu={(_, e) => {
              setMenuTarget({ kind: 'edge', id: e.id });
              useBoard.setState((s) => ({
                nodes: s.nodes.map((x) => (x.selected ? { ...x, selected: false } : x)),
                edges: s.edges.map((x) => (x.selected !== (x.id === e.id) ? { ...x, selected: x.id === e.id } : x)),
              }));
            }}
            onPaneContextMenu={(e) => {
              menuPoint.current = { x: e.clientX, y: e.clientY };
              setMenuTarget({ kind: 'pane' });
            }}
            onSelectionContextMenu={(_, sel) => sel[0] && setMenuTarget({ kind: 'node', id: sel[0].id })}
            onMoveEnd={(_, vp) => (viewport.current = vp)}
            connectionMode={ConnectionMode.Loose}
            defaultEdgeOptions={{ interactionWidth: 16 }}
            snapToGrid={snap}
            snapGrid={[10, 10]}
            selectionKeyCode="Shift"
            multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
            deleteKeyCode={['Delete', 'Backspace']}
            panActivationKeyCode="Space"
            minZoom={0.1}
            maxZoom={4}
            proOptions={{ hideAttribution: true }}
            colorMode={theme}
          >
            {snap && <Background variant={BackgroundVariant.Dots} gap={20} size={1.6} color="var(--mfd-dot)" />}
          </ReactFlow>
          </div>
          </CanvasMenu>
        </div>

        {/* painel de propriedades: só aparece quando há algo selecionado */}
        {hasSelection && (
          <aside className="w-80 shrink-0 overflow-y-auto overflow-x-hidden border-l border-line bg-surface text-ink">
            <PropertiesPanel />
          </aside>
        )}
      </div>

      {sql && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSql(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="mb-1 font-display text-lg font-semibold text-ink">{sql.mode === 'import' ? 'Importar DDL' : 'DDL gerado'}</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              {sql.mode === 'import' ? 'Cole comandos CREATE TABLE (PostgreSQL). Chaves estrangeiras viram relacionamentos.' : 'PostgreSQL gerado a partir das tabelas deste board.'}
            </p>
            <Textarea
              aria-label="SQL"
              className="min-h-72 flex-1 resize-none font-mono text-xs"
              autoFocus
              readOnly={sql.mode === 'export'}
              placeholder={'CREATE TABLE users (\n  id uuid PRIMARY KEY,\n  email text NOT NULL UNIQUE\n);'}
              value={sql.text}
              onChange={(e) => setSql({ ...sql, text: e.target.value })}
            />
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" onClick={() => setSql(null)}>Fechar</button>
              {sql.mode === 'import' ? (
                <button className="btn-primary" onClick={importSql}>Importar para o board</button>
              ) : (
                <>
                  <button className="btn" onClick={() => navigator.clipboard.writeText(sql.text)}>Copiar</button>
                  <button className="btn-primary" onClick={() => download(`${board?.name ?? 'schema'}.sql`, URL.createObjectURL(new Blob([sql.text], { type: 'text/sql' })))}>
                    Baixar .sql
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
