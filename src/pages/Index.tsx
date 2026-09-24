import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/hooks/use-auth'
import { getAccessibleTestIdentities, type TestIdentity } from '@/services/testAccess'

const roleLabels: Record<string, string> = {
  champion: 'Champion',
  participant: 'Participante',
  administrador_tecnico_condicionado: 'Administrador técnico condicionado',
}

function LoadingState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <p className="text-sm text-slate-300">Validando a sessão de teste…</p>
    </main>
  )
}

function LoginPage({ onSignIn }: { onSignIn: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await onSignIn(email.trim(), password)
    } catch {
      setError(
        'Não foi possível autenticar esta conta de teste. Confira os dados e tente novamente.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Lunáticos · ambiente seguro
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Acessos de teste</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Entre com uma identidade sintética para validar o acesso protegido do projeto.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-200">
            E-mail da identidade sintética
            <Input
              className="mt-2 border-slate-700 bg-slate-950 text-slate-100"
              type="email"
              autoComplete="username"
              placeholder="champion-a@tests.invalid"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Senha da conta de teste
            <Input
              className="mt-2 border-slate-700 bg-slate-950 text-slate-100"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          <Button className="w-full" type="submit" disabled={submitting}>
            {submitting ? 'Autenticando…' : 'Entrar no ambiente de teste'}
          </Button>
        </form>

        <p className="mt-6 text-xs leading-5 text-slate-400">
          Apenas contas sintéticas são aceitas nesta etapa. Nenhum dado terapêutico real deve ser
          inserido.
        </p>
      </section>
    </main>
  )
}

function ProtectedTestAccess({
  user,
  onSignOut,
}: {
  user: { name?: string; email?: string; test_role?: string; tenant_id?: string }
  onSignOut: () => void
}) {
  const [identities, setIdentities] = useState<TestIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getAccessibleTestIdentities()
      .then((records) => {
        if (active) setIdentities(records)
      })
      .catch((requestError) => {
        if (active) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Lunáticos · acesso protegido
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Visão autorizada do ambiente</h1>
            <p className="mt-3 text-sm text-slate-300">
              Sessão ativa para {user.name || user.email} ·{' '}
              {roleLabels[user.test_role || ''] || user.test_role}
            </p>
          </div>
          <Button variant="outline" onClick={onSignOut}>
            Sair
          </Button>
        </header>

        <section className="mt-8 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
          <p className="text-sm leading-6 text-cyan-100">
            O servidor decide quais identidades esta sessão pode consultar. O tenant e o papel
            exibidos abaixo não são aceitos do cliente como autoridade.
          </p>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Identidades acessíveis</h2>
              <p className="mt-1 text-sm text-slate-400">
                Resultado filtrado pelas regras server-side da coleção.
              </p>
            </div>
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
              {identities.length} registro(s)
            </span>
          </div>

          {loading && <p className="text-sm text-slate-300">Carregando visão autorizada…</p>}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950/60 p-4 text-sm text-red-200"
            >
              A visão protegida não pôde ser carregada: {error}
            </p>
          )}
          {!loading && !error && identities.length === 0 && (
            <p className="rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
              Nenhum registro foi retornado para esta sessão.
            </p>
          )}
          {!loading && !error && identities.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {identities.map((identity) => (
                <article
                  key={identity.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-100">{identity.display_name}</h3>
                      <p className="mt-1 text-xs uppercase tracking-wide text-cyan-300">
                        {roleLabels[identity.role] || identity.role}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-950 px-2.5 py-1 text-xs text-emerald-200">
                      {identity.status}
                    </span>
                  </div>
                  <dl className="mt-5 space-y-2 text-sm text-slate-300">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Fixture</dt>
                      <dd>{identity.fixture_key}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Tenant</dt>
                      <dd>{identity.tenant_id}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Natureza</dt>
                      <dd>{identity.is_synthetic ? 'sintética' : 'não autorizada'}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

const Index = () => {
  const { user, loading, isAuthenticated, signIn, signOut } = useAuth()

  if (loading) return <LoadingState />
  if (!isAuthenticated || !user) {
    return (
      <LoginPage
        onSignIn={async (email, password) => {
          await signIn(email, password)
        }}
      />
    )
  }

  return <ProtectedTestAccess user={user} onSignOut={signOut} />
}

export default Index
