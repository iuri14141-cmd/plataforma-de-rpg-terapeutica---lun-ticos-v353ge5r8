import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/hooks/use-auth'
import { getAccessibleTestIdentities, type TestIdentity } from '@/services/testAccess'
import { probeTestAccess, type ProbeResult } from '@/services/probe'
import { createTestInterest, type TestInterest } from '@/services/interests'
import { getLatestTenantInterest } from '@/services/interestQuery'
import {
  promoteTestParticipant,
  updateTestParticipant,
  getParticipantEvents,
  type TestParticipant,
  type ParticipantEvent,
} from '@/services/participants'

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
  const [probe, setProbe] = useState<ProbeResult | null>(null)
  const [probing, setProbing] = useState(false)
  const [interestName, setInterestName] = useState('')
  const [interestContact, setInterestContact] = useState('')
  const [interest, setInterest] = useState<TestInterest | null>(null)
  const [interestError, setInterestError] = useState('')
  const [creating, setCreating] = useState(false)
  const [participants, setParticipants] = useState<TestParticipant[]>([])
  const [timelineFor, setTimelineFor] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<ParticipantEvent[]>([])
  const [participantMessage, setParticipantMessage] = useState('')
  const [participantError, setParticipantError] = useState('')
  const [workingParticipant, setWorkingParticipant] = useState(false)

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

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Sonda de isolamento (server-side)</h2>
          <p className="mt-1 text-sm text-slate-400">
            O servidor decide pela associação real da sessão; valores de tenant ou papel enviados
            pelo cliente não são aceitos como autoridade.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={probing}
              onClick={async () => {
                setProbing(true)
                setProbe(null)
                try {
                  const result = await probeTestAccess('participant-b')
                  setProbe(result)
                } catch (requestError) {
                  // ClientResponseError.response é o corpo completo da resposta;
                  // err.data é alias de err.response (guia do SDK do Skip).
                  const err = requestError as {
                    response?: Partial<ProbeResult> & { data?: Partial<ProbeResult> }
                    data?: Partial<ProbeResult>
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setProbe({
                    outcome: 'denied',
                    rule_id: errorBody.rule_id ?? errorBody.data?.rule_id,
                    error: errorBody.error ?? getErrorMessage(requestError),
                  })
                } finally {
                  setProbing(false)
                }
              }}
            >
              {probing ? 'Consultando…' : 'Tentar acessar tenant B (participant-b)'}
            </Button>
            {probe && (
              <span
                className={
                  probe.outcome === 'allowed'
                    ? 'rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-200'
                    : 'rounded-full bg-red-950 px-3 py-1 text-xs text-red-200'
                }
              >
                {probe.outcome === 'allowed'
                  ? 'permitido'
                  : `negado · ${probe.rule_id || 'sem regra'}`}
              </span>
            )}
          </div>
          {probe?.error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {probe.error}
            </p>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Entrada de interesse de teste</h2>
          <p className="mt-1 text-sm text-slate-400">
            Registra uma solicitação sintética no seu tenant. Use apenas dados de teste
            (@tests.invalid); nenhum dado real é coletado nesta fase.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setInterestError('')
              setInterest(null)
              setCreating(true)
              try {
                const result = await createTestInterest(interestName.trim(), interestContact.trim())
                setInterest(result)
                if (result.duplicate) {
                  setInterestError(
                    'Solicitação já existente para esta chave neste tenant (idempotente).',
                  )
                }
              } catch (requestError) {
                const err = requestError as {
                  response?: { error?: string }
                  data?: { error?: string }
                }
                const errorBody = err?.response ?? err?.data ?? {}
                setInterestError(errorBody.error ?? getErrorMessage(requestError))
              } finally {
                setCreating(false)
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-200">
              Nome sintético
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={interestName}
                onChange={(event) => setInterestName(event.target.value)}
                placeholder="Ana Teste A"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Chave de contato sintética
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={interestContact}
                onChange={(event) => setInterestContact(event.target.value)}
                placeholder="ana.a@tests.invalid"
                required
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? 'Registrando…' : 'Registrar interesse de teste'}
              </Button>
            </div>
          </form>
          {interestError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {interestError}
            </p>
          )}
          {interest && (
            <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-100">
              <p className="font-semibold">Solicitação registrada</p>
              <dl className="mt-2 space-y-1 text-slate-200">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">ID</dt>
                  <dd>{interest.interest_id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Estado</dt>
                  <dd>{interest.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Request</dt>
                  <dd>{interest.request_id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Timestamp</dt>
                  <dd>{interest.created_at}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Auditoria</dt>
                  <dd>{interest.audit_event_id}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Participantes de teste</h2>
          <p className="mt-1 text-sm text-slate-400">
            Promova um interesse do seu tenant a participante, corrija a ficha e acompanhe a linha
            do tempo. Eventos são append-only: a origem nunca é apagada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={workingParticipant}
              onClick={async () => {
                setWorkingParticipant(true)
                setParticipantError('')
                setParticipantMessage('')
                try {
                  // O interesse vem do servidor (mais recente do tenant),
                  // não do estado em memória da página.
                  const latest = interest ?? (await getLatestTenantInterest())
                  if (!latest) {
                    setParticipantError(
                      'Nenhum interesse registrado neste tenant. Registre um interesse primeiro.',
                    )
                    return
                  }
                  const result = await promoteTestParticipant(latest.interest_id)
                  setParticipants((prev) => [
                    ...prev.filter((p) => p.participant_id !== result.participant_id),
                    result,
                  ])
                  setParticipantMessage(
                    result.already_registered
                      ? 'Participante já existia para este interesse (idempotente).'
                      : 'Participante registrado a partir do interesse.',
                  )
                } catch (requestError) {
                  const err = requestError as {
                    response?: { error?: string }
                    data?: { error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setParticipantError(errorBody.error ?? getErrorMessage(requestError))
                } finally {
                  setWorkingParticipant(false)
                }
              }}
            >
              {workingParticipant ? 'Processando…' : 'Promover interesse a participante'}
            </Button>
          </div>
          {participantError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {participantError}
            </p>
          )}
          {participantMessage && (
            <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {participantMessage}
            </p>
          )}
          {participants.map((participant) => (
            <article
              key={participant.participant_id}
              className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-100">{participant.display_name}</h3>
                  <p className="text-xs text-slate-400">{participant.contact_key}</p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {participant.lifecycle_status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={workingParticipant}
                  onClick={async () => {
                    setWorkingParticipant(true)
                    setParticipantError('')
                    try {
                      const result = await updateTestParticipant(participant.participant_id, {
                        display_name: `${participant.display_name} (corrigido)`,
                      })
                      setParticipants((prev) =>
                        prev.map((p) =>
                          p.participant_id === result.participant_id
                            ? { ...p, display_name: result.display_name }
                            : p,
                        ),
                      )
                      setParticipantMessage(`Ficha corrigida · evento ${result.event_type}`)
                    } catch (requestError) {
                      const err = requestError as {
                        response?: { error?: string }
                        data?: { error?: string }
                      }
                      const errorBody = err?.response ?? err?.data ?? {}
                      setParticipantError(errorBody.error ?? getErrorMessage(requestError))
                    } finally {
                      setWorkingParticipant(false)
                    }
                  }}
                >
                  Corrigir nome
                </Button>
                {participant.lifecycle_status !== 'cancelled' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingParticipant}
                    onClick={async () => {
                      setWorkingParticipant(true)
                      setParticipantError('')
                      try {
                        const result = await updateTestParticipant(participant.participant_id, {
                          action: 'cancel',
                          reason: 'cancelamento de teste',
                        })
                        setParticipants((prev) =>
                          prev.map((p) =>
                            p.participant_id === result.participant_id
                              ? { ...p, lifecycle_status: result.lifecycle_status }
                              : p,
                          ),
                        )
                        setParticipantMessage(`Cancelado · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setParticipantError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingParticipant(false)
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                {participant.lifecycle_status === 'cancelled' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingParticipant}
                    onClick={async () => {
                      setWorkingParticipant(true)
                      setParticipantError('')
                      try {
                        const result = await updateTestParticipant(participant.participant_id, {
                          action: 'reopen',
                          reason: 'reabertura de teste',
                        })
                        setParticipants((prev) =>
                          prev.map((p) =>
                            p.participant_id === result.participant_id
                              ? { ...p, lifecycle_status: result.lifecycle_status }
                              : p,
                          ),
                        )
                        setParticipantMessage(`Reaberto · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setParticipantError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingParticipant(false)
                      }
                    }}
                  >
                    Reabrir
                  </Button>
                )}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={workingParticipant}
                  onClick={async () => {
                    setWorkingParticipant(true)
                    setParticipantError('')
                    try {
                      const events = await getParticipantEvents(participant.participant_id)
                      setTimeline(events)
                      setTimelineFor(participant.participant_id)
                    } catch (requestError) {
                      const err = requestError as {
                        response?: { error?: string }
                        data?: { error?: string }
                      }
                      const errorBody = err?.response ?? err?.data ?? {}
                      setParticipantError(errorBody.error ?? getErrorMessage(requestError))
                    } finally {
                      setWorkingParticipant(false)
                    }
                  }}
                >
                  Ver linha do tempo
                </Button>
              </div>
              {timelineFor === participant.participant_id && (
                <ol className="mt-4 space-y-2 border-l border-slate-700 pl-4 text-sm text-slate-300">
                  {timeline.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium text-cyan-300">{item.event_type}</span>
                      {' · '}
                      <span className="text-slate-400">
                        {item.created} · ator {item.actor_id} · request {item.request_id}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </section>

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
