'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import Logo from '@/components/Logo';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, setToken } from '@/lib/api';
import { ThemeToggle } from '@/lib/theme';

/** Ilustração: um mini-diagrama desenhado "à mão" mostrando ER + fluxo + nota. */
function Illustration() {
  return (
    <svg viewBox="0 0 420 320" className="h-auto w-full max-w-md" fill="none" aria-hidden>
      <g stroke="var(--mfd-ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {/* tabela ER */}
        <rect x="20" y="30" width="140" height="104" rx="10" fill="var(--mfd-surface)" />
        <path d="M20 58h140" />
        <rect x="20" y="30" width="140" height="28" rx="10" fill="var(--mfd-ink)" />
        <path d="M34 78h40M34 98h56M34 118h32" stroke="var(--mfd-muted)" />
        <path d="M120 78h24M126 98h18M118 118h26" stroke="var(--mfd-line-strong)" />
        {/* relação */}
        <path d="M160 98h38q12 0 12 12v52" strokeDasharray="0" />
        <path d="M204 170l6-8 6 8M204 162h12" />
        {/* fluxo */}
        <rect x="150" y="172" width="120" height="44" rx="22" fill="var(--mfd-brand-soft)" stroke="var(--mfd-brand)" />
        <path d="M270 194h34" />
        <path d="M298 188l8 6-8 6" />
        <path d="M352 160l46 34-46 34-46-34Z" fill="var(--mfd-surface)" />
        <path d="M352 228v40" />
        <path d="M346 262l6 8 6-8" />
        <rect x="300" y="272" width="104" height="36" rx="6" fill="var(--mfd-surface)" />
      </g>
      {/* sticky */}
      <g transform="rotate(-6 300 70)">
        <rect x="246" y="26" width="120" height="96" fill="#FEF08A" />
        <path d="M258 52h80M258 68h64M258 84h72" stroke="#a16207" strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
      </g>
      <circle cx="210" cy="98" r="4" fill="var(--mfd-brand)" />
      <text x="34" y="49" fill="var(--mfd-bg)" fontFamily="var(--font-code)" fontSize="11" fontWeight="600">users</text>
      <text x="188" y="199" fill="var(--mfd-brand-ink)" fontFamily="var(--font-display-face)" fontSize="13" fontWeight="600">Checkout</text>
      <text x="337" y="198" fill="var(--mfd-ink)" fontFamily="var(--font-display-face)" fontSize="12" fontWeight="600">ok?</text>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const res = await api<{ token: string }>(`/auth/${mode}`, { method: 'POST', json: body });
      setToken(res.token);
      router.replace('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="paper grid min-h-full lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between p-10 lg:flex">
        <Logo />
        <div>
          <p className="eyebrow mb-4">ER · Fluxogramas · Notas · Imagens</p>
          <h1 className="max-w-lg font-display text-5xl font-bold leading-[1.05] tracking-tight text-ink">
            Seu projeto inteiro, <span className="relative whitespace-nowrap text-brand">
              num só traço
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
                <path d="M2 7c40-5 120-6 196-2" stroke="var(--mfd-brand)" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            .
          </h1>
          <p className="mt-5 max-w-md text-ink-soft">
            Modele o banco, desenhe os processos, anote decisões e cole os prints — tudo em boards infinitos, organizados por projeto.
          </p>
          <div className="mt-10">
            <Illustration />
          </div>
        </div>
        <p className="font-mono text-xs text-muted">© MyFineDraw</p>
      </section>

      <section className="flex items-center justify-center p-4 sm:p-8">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-7 shadow-soft">
          <div className="mb-6 lg:hidden">
            <Logo />
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h2>
          <p className="mb-6 mt-1 text-sm text-muted">{mode === 'login' ? 'Entre para continuar seus projetos.' : 'Leva menos de um minuto.'}</p>

          <FieldGroup className="mb-5 gap-4">
            {mode === 'register' && (
              <Field className="gap-1.5">
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input id="name" className="h-10" autoComplete="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
            )}
            <Field className="gap-1.5">
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" className="h-10" type="email" autoComplete="email" placeholder="voce@empresa.com" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field className="gap-1.5" data-invalid={!!error || undefined}>
              <FieldLabel htmlFor="password">Senha</FieldLabel>
              <Input
                id="password"
                className="h-10"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={mode === 'register' ? 6 : undefined}
                aria-invalid={!!error || undefined}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              {mode === 'register' && <FieldDescription className="text-xs">Mínimo de 6 caracteres.</FieldDescription>}
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>
          <button className="btn-primary w-full justify-center !py-2.5" disabled={loading}>
            {loading ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted hover:text-ink"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          >
            {mode === 'login' ? (
              <>Não tem conta? <span className="font-semibold text-brand">Cadastre-se</span></>
            ) : (
              <>Já tem conta? <span className="font-semibold text-brand">Entrar</span></>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
