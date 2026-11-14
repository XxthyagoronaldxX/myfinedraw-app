'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Logo from '@/components/Logo';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { api, Project } from '@/lib/api';
import { ThemeToggle } from '@/lib/theme';
import { useRequireAuth } from '@/lib/useAuth';

const COLORS = ['#EC4F2B', '#2F5BD3', '#0E9F6E', '#D97706', '#8B5CF6', '#DB2777', '#0891B2', '#475569'];

function relative(date: string) {
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 30) return `há ${Math.floor(s / 86400)} d`;
  return new Date(date).toLocaleDateString('pt-BR');
}

/** Capa gerada a partir da cor do projeto: blocos e conectores como num board. */
function Cover({ color, seed }: { color: string; seed: string }) {
  const n = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const x1 = 18 + (n % 30);
  const x2 = 120 + (n % 50);
  const y2 = 14 + (n % 22);
  return (
    <svg viewBox="0 0 240 88" className="h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id={`g${seed}`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="var(--mfd-dot)" />
        </pattern>
      </defs>
      <rect width="240" height="88" fill="var(--mfd-canvas)" />
      <rect width="240" height="88" fill={`url(#g${seed})`} />
      <path d={`M${x1 + 56} 40 H${x2 - 20} Q${x2 - 8} 40 ${x2 - 8} ${y2 + 18} V${y2 + 14}`} stroke="var(--mfd-line-strong)" strokeWidth="1.5" fill="none" />
      <rect x={x1} y="24" width="56" height="34" rx="6" fill={color} opacity=".9" />
      <rect x={x1 + 8} y="34" width="28" height="3" rx="1.5" fill="white" opacity=".8" />
      <rect x={x1 + 8} y="42" width="18" height="3" rx="1.5" fill="white" opacity=".5" />
      <rect x={x2 - 30} y={y2} width="48" height="14" rx="7" fill="var(--mfd-surface)" stroke={color} strokeWidth="1.5" />
      <path d={`M${x2 + 60} 34 l14 14 -14 14 -14 -14Z`} fill="var(--mfd-surface)" stroke="var(--mfd-line-strong)" strokeWidth="1.5" />
    </svg>
  );
}

export default function WorkspacePage() {
  const { user, logout } = useRequireAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: COLORS[0], tags: '' });

  const load = () => api<Project[]>('/projects').then(setProjects);
  useEffect(() => {
    if (user) load();
  }, [user]);

  const allTags = useMemo(() => [...new Set((projects ?? []).flatMap((p) => p.tags))].sort(), [projects]);
  const visible = (projects ?? []).filter(
    (p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!tag || p.tags.includes(tag)),
  );

  async function create(e: FormEvent) {
    e.preventDefault();
    await api('/projects', {
      method: 'POST',
      json: {
        name: form.name,
        description: form.description || undefined,
        color: form.color,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      },
    });
    setForm({ name: '', description: '', color: COLORS[0], tags: '' });
    setCreating(false);
    load();
  }

  async function remove(p: Project) {
    if (!confirm(`Excluir o projeto "${p.name}" e todos os seus boards? Essa ação não pode ser desfeita.`)) return;
    await api(`/projects/${p.id}`, { method: 'DELETE' });
    load();
  }

  if (!user) return null;
  const firstName = user.name.split(' ')[0];

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Logo />
          <div className="ml-auto flex items-center gap-3">
            <ThemeToggle />
            <div className="hidden items-center gap-2 sm:flex">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-surface">
                {user.name[0]?.toUpperCase()}
              </span>
              <div className="leading-tight">
                <div className="text-sm font-medium text-ink">{user.name}</div>
                {user.role === 'superadmin' && <div className="font-mono text-[10px] uppercase tracking-wider text-brand">superadmin</div>}
              </div>
            </div>
            <button className="btn-ghost" onClick={logout}>Sair</button>
          </div>
        </div>
      </header>

      <main className="paper min-h-[calc(100vh-4rem)]">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
          <p className="eyebrow">Workspace</p>
          <div className="mb-8 mt-2 flex flex-wrap items-end gap-3">
            <h1 className="mr-auto font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Olá, {firstName}. <span className="text-muted">O que vamos desenhar?</span>
            </h1>
            <button className="btn-primary !px-4 !py-2" onClick={() => setCreating(true)}>+ Novo projeto</button>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Buscar projeto" className="pl-8" placeholder="Buscar projeto…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['', ...allTags].map((t) => (
                <button
                  key={t || '__all'}
                  onClick={() => setTag(t)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${tag === t ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-soft hover:border-line-strong'}`}
                >
                  {t || 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {creating && (
            <form onSubmit={create} className="mb-8 grid gap-4 rounded-2xl border border-line bg-surface p-5 shadow-soft sm:grid-cols-2">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="p-name">Nome</FieldLabel>
                <Input id="p-name" autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="p-tags">Tags</FieldLabel>
                <Input id="p-tags" placeholder="backend, cliente-x" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                <FieldDescription className="text-xs">Separadas por vírgula.</FieldDescription>
              </Field>
              <Field className="gap-1.5 sm:col-span-2">
                <FieldLabel htmlFor="p-desc">Descrição</FieldLabel>
                <Textarea id="p-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
              <div className="flex items-center gap-2">
                {COLORS.map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-label={`Cor ${c}`}
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-7 w-7 rounded-full transition ${form.color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : 'hover:scale-105'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn" onClick={() => setCreating(false)}>Cancelar</button>
                <button className="btn-primary">Criar projeto</button>
              </div>
            </form>
          )}

          {projects === null ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-52 animate-pulse rounded-2xl border border-line bg-surface" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line-strong bg-surface/70 py-16 text-center">
              <p className="font-display text-lg font-semibold text-ink">{projects.length ? 'Nada encontrado' : 'Sua prancheta está vazia'}</p>
              <p className="mt-1 text-sm text-muted">{projects.length ? 'Tente outra busca ou tag.' : 'Crie o primeiro projeto e comece a desenhar.'}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((p) => (
                <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-soft">
                  <Link href={`/p/${p.id}`} className="block">
                    <div className="h-24 border-b border-line">
                      <Cover color={p.color} seed={p.id.slice(0, 8)} />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.color }} />
                        <span className="truncate font-display text-lg font-semibold text-ink">{p.name}</span>
                      </div>
                      {p.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span key={t} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-soft">#{t}</span>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-muted">
                        <span>{p._count?.boards ?? 0} board(s)</span>
                        <span>{relative(p.updatedAt)}</span>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={() => remove(p)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-surface/90 text-sm text-muted opacity-0 shadow-soft transition hover:text-brand group-hover:opacity-100"
                    title="Excluir projeto"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
