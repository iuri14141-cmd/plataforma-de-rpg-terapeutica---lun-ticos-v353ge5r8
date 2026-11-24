import { FormEvent, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth } from '@/hooks/use-auth'
import { getAccessibleTestIdentities, type TestIdentity } from '@/services/testAccess'
import { probeTestAccess, type ProbeResult } from '@/services/probe'
import {
  createTestInterest,
  createTestInterestWithFailureMode,
  listTenantInterests,
  type InterestListItem,
  type TestInterest,
} from '@/services/interests'
import { getLatestTenantInterest } from '@/services/interestQuery'
import {
  createScreeningSubmission,
  getScreeningQueue,
  type ScreeningQueue,
  type ScreeningSubmission,
} from '@/services/screening'
import {
  createScreeningDecision,
  getScreeningDecisionTimeline,
  type ScreeningDecision,
  type ScreeningDecisionTimeline,
} from '@/services/decisions'
import {
  createTestReferral,
  getReferralTimeline,
  type ReferralTimeline,
} from '@/services/referrals'
import {
  promoteTestParticipant,
  updateTestParticipant,
  getParticipantEvents,
  type TestParticipant,
  type ParticipantEvent,
} from '@/services/participants'
import {
  createTestMission,
  updateTestMission,
  listTenantMissions,
  getMissionTimeline,
  type MissionEventView,
  type TestMission,
} from '@/services/missions'
import {
  createTestMissionLink,
  removeTestMissionLink,
  listTenantMissionLinks,
  listTenantParticipants,
  getParticipantMissionView,
  probeCrossTenantLink,
  getLinkTimeline,
  type MissionLink,
  type TenantParticipant,
  type MissionLinkEventView,
} from '@/services/missionLinks'

const APP_VERSION = '0.0.32'

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
  const [demoName, setDemoName] = useState('')
  const [demoContact, setDemoContact] = useState('')
  const [demoMessage, setDemoMessage] = useState('')
  const [demoError, setDemoError] = useState('')
  const [demoWorking, setDemoWorking] = useState(false)
  const [demoList, setDemoList] = useState<InterestListItem[]>([])
  const [participants, setParticipants] = useState<TestParticipant[]>([])
  const [timelineFor, setTimelineFor] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<ParticipantEvent[]>([])
  const [participantMessage, setParticipantMessage] = useState('')
  const [participantError, setParticipantError] = useState('')
  const [workingParticipant, setWorkingParticipant] = useState(false)
  const [missionTitle, setMissionTitle] = useState('')
  const [missionModality, setMissionModality] = useState<'individual' | 'grupo'>('individual')
  const [missionObjective, setMissionObjective] = useState('')
  const [missions, setMissions] = useState<TestMission[]>([])
  const [missionMessage, setMissionMessage] = useState('')
  const [missionError, setMissionError] = useState('')
  const [workingMission, setWorkingMission] = useState(false)
  const [links, setLinks] = useState<MissionLink[]>([])
  const [tenantParticipants, setTenantParticipants] = useState<TenantParticipant[]>([])
  const [linkMissionId, setLinkMissionId] = useState('')
  const [linkParticipantId, setLinkParticipantId] = useState('')
  const [linkMessage, setLinkMessage] = useState('')
  const [linkError, setLinkError] = useState('')
  const [workingLink, setWorkingLink] = useState(false)
  const [missionTimeline, setMissionTimeline] = useState<MissionEventView[]>([])
  const [missionTimelineFor, setMissionTimelineFor] = useState<string | null>(null)
  const [linkTimeline, setLinkTimeline] = useState<MissionLinkEventView[]>([])
  const [linkTimelineFor, setLinkTimelineFor] = useState<string | null>(null)
  const [probeResult, setProbeResult] = useState<{
    outcome: string
    rule_id?: string
    audit_event_id?: string
    error?: string
  } | null>(null)
  const [probingLink, setProbingLink] = useState(false)
  const [screeningName, setScreeningName] = useState('')
  const [screeningContact, setScreeningContact] = useState('')
  const [screeningMotivation, setScreeningMotivation] = useState('')
  const [screeningGoal, setScreeningGoal] = useState('')
  const [screeningAckReplacement, setScreeningAckReplacement] = useState(false)
  const [screeningAckDiagnosis, setScreeningAckDiagnosis] = useState(false)
  const [screeningConsentRecording, setScreeningConsentRecording] = useState(false)
  const [screeningConsentConfidentiality, setScreeningConsentConfidentiality] = useState(false)
  const [screeningResult, setScreeningResult] = useState<ScreeningSubmission | null>(null)
  const [screeningQueue, setScreeningQueue] = useState<ScreeningQueue | null>(null)
  const [screeningMessage, setScreeningMessage] = useState('')
  const [screeningError, setScreeningError] = useState('')
  const [screeningWorking, setScreeningWorking] = useState(false)
  const [decisionFor, setDecisionFor] = useState<string | null>(null)
  const [decisionChoice, setDecisionChoice] = useState<'elegivel' | 'nao_elegivel' | 'pendente'>(
    'elegivel',
  )
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionMessage, setDecisionMessage] = useState('')
  const [decisionError, setDecisionError] = useState('')
  const [workingDecision, setWorkingDecision] = useState(false)
  const [decisionTimeline, setDecisionTimeline] = useState<ScreeningDecisionTimeline | null>(null)
  const [decisionTimelineFor, setDecisionTimelineFor] = useState<string | null>(null)
  const [referralFor, setReferralFor] = useState<string | null>(null)
  const [referralDestination, setReferralDestination] = useState<'individual' | 'grupo'>(
    'individual',
  )
  const [referralReason, setReferralReason] = useState('')
  const [referralMessage, setReferralMessage] = useState('')
  const [referralError, setReferralError] = useState('')
  const [workingReferral, setWorkingReferral] = useState(false)
  const [referralTimeline, setReferralTimeline] = useState<ReferralTimeline | null>(null)
  const [referralTimelineFor, setReferralTimelineFor] = useState<string | null>(null)

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
              {roleLabels[user.test_role || ''] || user.test_role} · build {APP_VERSION}
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

        <section className="mt-8 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
          <h2 className="text-lg font-semibold">Demonstração de falha de gravação (F2-T01)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Registra um interesse de teste pelo modo controlado da demonstração. Com a falha ligada,
            o servidor responde com erro e nenhum registro é criado; com a falha desligada, o
            cadastro grava normalmente e o reenvio não cria segunda ficha.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setDemoError('')
              setDemoMessage('')
              setDemoWorking(true)
              try {
                const result = await createTestInterestWithFailureMode(
                  demoName.trim(),
                  demoContact.trim(),
                )
                setDemoMessage(
                  result.duplicate
                    ? 'Cadastro já existia (idempotente) — apenas uma ficha.'
                    : 'Cadastro gravado com sucesso.',
                )
              } catch (requestError) {
                const err = requestError as {
                  response?: { error?: string }
                  data?: { error?: string }
                }
                const errorBody = err?.response ?? err?.data ?? {}
                setDemoError(
                  errorBody.error ??
                    'Não foi possível salvar o cadastro. Verifique os dados e tente novamente.',
                )
              } finally {
                setDemoWorking(false)
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-200">
              Nome fictício da demonstração
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={demoName}
                onChange={(event) => setDemoName(event.target.value)}
                placeholder="Bento Teste F2"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              E-mail fictício da demonstração
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={demoContact}
                onChange={(event) => setDemoContact(event.target.value)}
                placeholder="bento.f2@tests.invalid"
                type="email"
                required
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={demoWorking}>
                {demoWorking ? 'Enviando…' : 'Enviar cadastro da demonstração'}
              </Button>
            </div>
          </form>
          {demoError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {demoError}
            </p>
          )}
          {demoMessage && (
            <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {demoMessage}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              size="small"
              variant="secondary"
              disabled={demoWorking}
              onClick={async () => {
                setDemoWorking(true)
                setDemoError('')
                try {
                  setDemoList(await listTenantInterests())
                } catch (requestError) {
                  const err = requestError as {
                    response?: { error?: string }
                    data?: { error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setDemoError(errorBody.error ?? getErrorMessage(requestError))
                } finally {
                  setDemoWorking(false)
                }
              }}
            >
              {demoWorking ? 'Carregando…' : 'Listar fichas da demonstração'}
            </Button>
          </div>
          {demoList.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {demoList.map((item) => (
                <li
                  key={item.interest_id}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  {item.display_name} · {item.contact_key} · {item.status} · {item.created_at}
                </li>
              ))}
            </ul>
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
          <h2 className="text-lg font-semibold">Triagem (F2-T03)</h2>
          <p className="mt-1 text-sm text-slate-400">
            Formulário inicial de triagem com dados sintéticos. Sem campo de saúde: apenas ciência
            declarada (não substitui psicólogo/psiquiatra; não há diagnósticos). A fila mostra o
            essencial de cada ficha, com estado, do mais antigo para o mais novo. A decisão de
            triagem (F2-T04) é sempre sua: cada registro mostra quem decidiu, quando e por quê, e a
            decisão anterior nunca é apagada.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setScreeningError('')
              setScreeningMessage('')
              setScreeningWorking(true)
              try {
                const result = await createScreeningSubmission({
                  display_name: screeningName.trim(),
                  contact_key: screeningContact.trim(),
                  motivation: screeningMotivation.trim(),
                  goal: screeningGoal.trim(),
                  ack_not_replacement: screeningAckReplacement,
                  ack_no_diagnosis: screeningAckDiagnosis,
                  consent_recording: screeningConsentRecording,
                  consent_confidentiality: screeningConsentConfidentiality,
                })
                setScreeningResult(result)
                if (result.duplicate) {
                  setScreeningMessage('Submissão já existente para esta chave (idempotente).')
                } else {
                  setScreeningMessage('Submissão registrada na fila de triagem.')
                }
                const queue = await getScreeningQueue()
                setScreeningQueue(queue)
              } catch (requestError) {
                const err = requestError as {
                  response?: { error?: string }
                  data?: { error?: string }
                }
                const errorBody = err?.response ?? err?.data ?? {}
                setScreeningError(errorBody.error ?? getErrorMessage(requestError))
              } finally {
                setScreeningWorking(false)
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-200">
              Nome sintético
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={screeningName}
                onChange={(event) => setScreeningName(event.target.value)}
                placeholder="Carla Teste C"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Chave de contato sintética
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={screeningContact}
                onChange={(event) => setScreeningContact(event.target.value)}
                placeholder="carla.c@tests.invalid"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
              O que motivou você a procurar o RPG terapêutico?
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={screeningMotivation}
                onChange={(event) => setScreeningMotivation(event.target.value)}
                placeholder="Resposta de teste — nada real nesta fase."
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
              O que você pretende com a terapia?
              <textarea
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={screeningGoal}
                onChange={(event) => setScreeningGoal(event.target.value)}
                placeholder="Resposta de teste — nada real nesta fase."
                required
              />
            </label>
            <div className="sm:col-span-2 space-y-2 text-sm text-slate-200">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={screeningAckReplacement}
                  onChange={(event) => setScreeningAckReplacement(event.target.checked)}
                  required
                />
                <span>
                  Declaro ciência de que o RPG terapêutico não substitui psicólogo ou psiquiatra.
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={screeningAckDiagnosis}
                  onChange={(event) => setScreeningAckDiagnosis(event.target.checked)}
                  required
                />
                <span>Declaro ciência de que o atendimento não inclui diagnósticos.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={screeningConsentRecording}
                  onChange={(event) => setScreeningConsentRecording(event.target.checked)}
                  required
                />
                <span>Autorizo a gravação das sessões de RPG terapêutico.</span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={screeningConsentConfidentiality}
                  onChange={(event) => setScreeningConsentConfidentiality(event.target.checked)}
                  required
                />
                <span>
                  Comprometo-me a manter sigilo sobre o comportamento dos demais participantes.
                </span>
              </label>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={screeningWorking}>
                {screeningWorking ? 'Enviando…' : 'Enviar submissão de triagem'}
              </Button>
            </div>
          </form>
          {screeningError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {screeningError}
            </p>
          )}
          {screeningMessage && (
            <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {screeningMessage}
            </p>
          )}
          {screeningResult && !screeningResult.duplicate && (
            <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-100">
              <p className="font-semibold">Submissão registrada</p>
              <dl className="mt-2 space-y-1 text-slate-200">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">ID</dt>
                  <dd>{screeningResult.submission_id}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Estado</dt>
                  <dd>{screeningResult.status}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Timestamp</dt>
                  <dd>{screeningResult.created_at}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Auditoria</dt>
                  <dd>{screeningResult.audit_event_id}</dd>
                </div>
              </dl>
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              disabled={screeningWorking}
              onClick={async () => {
                setScreeningWorking(true)
                setScreeningError('')
                try {
                  const queue = await getScreeningQueue()
                  setScreeningQueue(queue)
                } catch (requestError) {
                  const err = requestError as {
                    response?: { error?: string }
                    data?: { error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setScreeningError(errorBody.error ?? getErrorMessage(requestError))
                } finally {
                  setScreeningWorking(false)
                }
              }}
            >
              {screeningWorking ? 'Carregando…' : 'Atualizar fila de triagem'}
            </Button>
            {screeningQueue && (
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                {screeningQueue.count} ficha(s) na fila
              </span>
            )}
          </div>
          {screeningQueue && screeningQueue.items.length === 0 && (
            <p className="mt-4 rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
              Nenhuma submissão na fila deste tenant.
            </p>
          )}
          {screeningQueue && screeningQueue.items.length > 0 && (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {screeningQueue.items.map((item) => (
                <li
                  key={item.submission_id}
                  className="rounded-lg border border-slate-800 bg-slate-950 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">
                        {item.display_name} · {item.contact_key}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Motivação: {item.motivation}</p>
                      <p className="text-xs text-slate-400">Objetivo: {item.goal}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Ciências/consentimentos: não-substituição{' '}
                        {item.ack_not_replacement ? '✓' : '✗'} · sem diagnóstico{' '}
                        {item.ack_no_diagnosis ? '✓' : '✗'} · gravação{' '}
                        {item.consent_recording ? '✓' : '✗'} · sigilo{' '}
                        {item.consent_confidentiality ? '✓' : '✗'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                        {item.status}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">{item.created_at}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(['elegivel', 'nao_elegivel', 'pendente'] as const).map((choice) => (
                      <Button
                        key={choice}
                        size="small"
                        variant="secondary"
                        disabled={workingDecision}
                        onClick={() => {
                          setDecisionFor(item.submission_id)
                          setDecisionChoice(choice)
                          setDecisionReason('')
                          setDecisionError('')
                          setDecisionMessage('')
                        }}
                      >
                        {choice === 'elegivel'
                          ? 'Marcar elegível'
                          : choice === 'nao_elegivel'
                            ? 'Marcar não elegível'
                            : 'Marcar pendente'}
                      </Button>
                    ))}
                    <Button
                      size="small"
                      variant="secondary"
                      disabled={workingDecision}
                      onClick={async () => {
                        setWorkingDecision(true)
                        setDecisionError('')
                        try {
                          const timeline = await getScreeningDecisionTimeline(item.submission_id)
                          setDecisionTimeline(timeline)
                          setDecisionTimelineFor(item.submission_id)
                        } catch (requestError) {
                          const err = requestError as {
                            response?: { error?: string }
                            data?: { error?: string }
                          }
                          const errorBody = err?.response ?? err?.data ?? {}
                          setDecisionError(errorBody.error ?? getErrorMessage(requestError))
                        } finally {
                          setWorkingDecision(false)
                        }
                      }}
                    >
                      Ver decisões
                    </Button>
                  </div>
                  {decisionFor === item.submission_id && (
                    <form
                      className="mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        setDecisionError('')
                        setDecisionMessage('')
                        setWorkingDecision(true)
                        try {
                          const result = await createScreeningDecision(
                            item.submission_id,
                            decisionChoice,
                            decisionReason.trim(),
                          )
                          setDecisionMessage(
                            `Decisão registrada: ${result.decision} · por ${result.decided_by} · ${result.created_at}`,
                          )
                          setDecisionFor(null)
                          setDecisionReason('')
                          const queue = await getScreeningQueue()
                          setScreeningQueue(queue)
                        } catch (requestError) {
                          const err = requestError as {
                            response?: { error?: string }
                            data?: { error?: string }
                          }
                          const errorBody = err?.response ?? err?.data ?? {}
                          setDecisionError(errorBody.error ?? getErrorMessage(requestError))
                        } finally {
                          setWorkingDecision(false)
                        }
                      }}
                    >
                      <p className="text-xs font-medium text-slate-200">
                        Decisão: {decisionChoice} — a justificativa é obrigatória (quem, quando e
                        por quê ficam registrados; a decisão anterior nunca é apagada).
                      </p>
                      <textarea
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                        value={decisionReason}
                        onChange={(event) => setDecisionReason(event.target.value)}
                        placeholder="Justificativa da decisão (texto livre)"
                        required
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={workingDecision}>
                          {workingDecision ? 'Registrando…' : 'Registrar decisão'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={workingDecision}
                          onClick={() => setDecisionFor(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
                  {decisionError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
                    >
                      {decisionError}
                    </p>
                  )}
                  {decisionMessage && (
                    <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                      {decisionMessage}
                    </p>
                  )}
                  {decisionTimelineFor === item.submission_id && decisionTimeline && (
                    <ol className="mt-3 space-y-2 border-l border-slate-700 pl-4 text-sm text-slate-300">
                      {decisionTimeline.items.length === 0 && (
                        <li className="text-slate-500">Nenhuma decisão registrada ainda.</li>
                      )}
                      {decisionTimeline.items.map((entry) => (
                        <li key={entry.decision_id}>
                          <span className="font-medium text-cyan-300">{entry.decision}</span>
                          {' · '}
                          <span className="text-slate-400">
                            {entry.created_at} · decidido por {entry.decided_by}
                          </span>
                          <p className="text-xs text-slate-500">Justificativa: {entry.reason}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                  {item.status === 'screened' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={workingReferral}
                        onClick={() => {
                          setReferralFor(item.submission_id)
                          setReferralDestination('individual')
                          setReferralReason('')
                          setReferralError('')
                          setReferralMessage('')
                        }}
                      >
                        Encaminhar
                      </Button>
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={workingReferral}
                        onClick={async () => {
                          setWorkingReferral(true)
                          setReferralError('')
                          try {
                            const timeline = await getReferralTimeline(item.submission_id)
                            setReferralTimeline(timeline)
                            setReferralTimelineFor(item.submission_id)
                          } catch (requestError) {
                            const err = requestError as {
                              response?: { error?: string }
                              data?: { error?: string }
                            }
                            const errorBody = err?.response ?? err?.data ?? {}
                            setReferralError(errorBody.error ?? getErrorMessage(requestError))
                          } finally {
                            setWorkingReferral(false)
                          }
                        }}
                      >
                        Ver encaminhamentos
                      </Button>
                    </div>
                  )}
                  {referralFor === item.submission_id && (
                    <form
                      className="mt-3 space-y-3 rounded-lg border border-slate-700 bg-slate-900 p-3"
                      onSubmit={async (event) => {
                        event.preventDefault()
                        setReferralError('')
                        setReferralMessage('')
                        setWorkingReferral(true)
                        try {
                          const result = await createTestReferral(
                            item.submission_id,
                            referralDestination,
                            referralReason.trim(),
                          )
                          setReferralMessage(
                            result.participant_created
                              ? `Encaminhamento registrado: ${result.destination} · participante criado automaticamente (${result.participant_id.slice(0, 8)}…) · por ${result.referred_by} · ${result.created_at}`
                              : `Encaminhamento registrado: ${result.destination} · participante já existia (idempotente) · por ${result.referred_by} · ${result.created_at}`,
                          )
                          // Recarrega a lista de participantes do tenant para
                          // a ficha encaminhada aparecer nos vínculos.
                          try {
                            setTenantParticipants(await listTenantParticipants())
                          } catch (_) {
                            // falha de recarga não invalida o encaminhamento
                          }
                          setReferralFor(null)
                          setReferralReason('')
                          const queue = await getScreeningQueue()
                          setScreeningQueue(queue)
                        } catch (requestError) {
                          const err = requestError as {
                            response?: { error?: string }
                            data?: { error?: string }
                          }
                          const errorBody = err?.response ?? err?.data ?? {}
                          setReferralError(errorBody.error ?? getErrorMessage(requestError))
                        } finally {
                          setWorkingReferral(false)
                        }
                      }}
                    >
                      <p className="text-xs font-medium text-slate-200">
                        Encaminhamento da ficha elegível — a justificativa é obrigatória (quem,
                        quando e por quê ficam registrados; o encaminhamento anterior nunca é
                        apagado).
                      </p>
                      <label className="block text-sm font-medium text-slate-200">
                        Destino
                        <select
                          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                          value={referralDestination}
                          onChange={(event) =>
                            setReferralDestination(event.target.value as 'individual' | 'grupo')
                          }
                        >
                          <option value="individual">individual</option>
                          <option value="grupo">grupo</option>
                        </select>
                      </label>
                      <textarea
                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                        value={referralReason}
                        onChange={(event) => setReferralReason(event.target.value)}
                        placeholder="Justificativa do encaminhamento (texto livre)"
                        required
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button type="submit" disabled={workingReferral}>
                          {workingReferral ? 'Registrando…' : 'Registrar encaminhamento'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={workingReferral}
                          onClick={() => setReferralFor(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  )}
                  {referralError && (
                    <p
                      role="alert"
                      className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
                    >
                      {referralError}
                    </p>
                  )}
                  {referralMessage && (
                    <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
                      {referralMessage}
                    </p>
                  )}
                  {referralTimelineFor === item.submission_id && referralTimeline && (
                    <ol className="mt-3 space-y-2 border-l border-slate-700 pl-4 text-sm text-slate-300">
                      {referralTimeline.items.length === 0 && (
                        <li className="text-slate-500">Nenhum encaminhamento registrado ainda.</li>
                      )}
                      {referralTimeline.items.map((entry) => (
                        <li key={entry.referral_id}>
                          <span className="font-medium text-cyan-300">{entry.destination}</span>
                          {' · '}
                          <span className="text-slate-400">
                            {entry.created_at} · encaminhado por {entry.referred_by}
                          </span>
                          <p className="text-xs text-slate-500">Justificativa: {entry.reason}</p>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ul>
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

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Missões de teste</h2>
          <p className="mt-1 text-sm text-slate-400">
            Cria missão individual ou de grupo no seu tenant, sempre iniciando em rascunho. Sem
            sessão, prontidão, convite ou composição automática nesta fase. Campanha de grupo
            (F2-T05): 3 a 6 pessoas, 12 encontros, frequência semanal — parâmetros definidos pelo
            Champion e gravados server-side.
          </p>
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setMissionError('')
              setMissionMessage('')
              setWorkingMission(true)
              try {
                const result = await createTestMission(
                  missionTitle.trim(),
                  missionModality,
                  missionObjective.trim(),
                )
                setMissions((prev) => [result, ...prev])
                setMissionMessage(`Missão criada em ${result.status} · evento registrado`)
              } catch (requestError) {
                const err = requestError as {
                  response?: { error?: string }
                  data?: { error?: string }
                }
                const errorBody = err?.response ?? err?.data ?? {}
                setMissionError(errorBody.error ?? getErrorMessage(requestError))
              } finally {
                setWorkingMission(false)
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-200">
              Título sintético
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={missionTitle}
                onChange={(event) => setMissionTitle(event.target.value)}
                placeholder="Missão A Individual"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Modalidade
              <select
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={missionModality}
                onChange={(event) =>
                  setMissionModality(event.target.value as 'individual' | 'grupo')
                }
              >
                <option value="individual">individual</option>
                <option value="grupo">grupo</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200 sm:col-span-2">
              Objetivo de teste (não vazio)
              <input
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={missionObjective}
                onChange={(event) => setMissionObjective(event.target.value)}
                placeholder="Objetivo sintético da missão de teste"
                required
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={workingMission}>
                {workingMission ? 'Criando…' : 'Criar missão de teste'}
              </Button>
            </div>
          </form>
          {missionError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {missionError}
            </p>
          )}
          {missionMessage && (
            <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {missionMessage}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              size="small"
              variant="secondary"
              disabled={workingMission}
              onClick={async () => {
                setWorkingMission(true)
                setMissionError('')
                try {
                  setMissions(await listTenantMissions())
                } catch (requestError) {
                  const err = requestError as {
                    response?: { error?: string }
                    data?: { error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setMissionError(errorBody.error ?? getErrorMessage(requestError))
                } finally {
                  setWorkingMission(false)
                }
              }}
            >
              {workingMission ? 'Atualizando…' : 'Listar missões do tenant'}
            </Button>
          </div>
          {missions.map((mission) => (
            <article
              key={mission.mission_id}
              className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-100">{mission.title}</h3>
                  <p className="text-xs text-slate-400">
                    {mission.modality} · {mission.objective}
                    {mission.modality === 'grupo' && mission.group_min
                      ? ` · grupo ${mission.group_min}–${mission.group_max} pessoas · ${mission.sessions_total} encontros · ${mission.frequency}`
                      : ''}
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {mission.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {mission.status === 'rascunho' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingMission}
                    onClick={async () => {
                      setWorkingMission(true)
                      setMissionError('')
                      try {
                        const result = await updateTestMission(mission.mission_id, 'activate')
                        setMissions((prev) =>
                          prev.map((m) =>
                            m.mission_id === result.mission_id
                              ? { ...m, status: result.status }
                              : m,
                          ),
                        )
                        setMissionMessage(`Missão ${result.status} · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setMissionError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingMission(false)
                      }
                    }}
                  >
                    Ativar
                  </Button>
                )}
                {mission.status === 'ativa' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingMission}
                    onClick={async () => {
                      setWorkingMission(true)
                      setMissionError('')
                      try {
                        const result = await updateTestMission(mission.mission_id, 'pause')
                        setMissions((prev) =>
                          prev.map((m) =>
                            m.mission_id === result.mission_id
                              ? { ...m, status: result.status }
                              : m,
                          ),
                        )
                        setMissionMessage(`Missão ${result.status} · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setMissionError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingMission(false)
                      }
                    }}
                  >
                    Pausar
                  </Button>
                )}
                {(mission.status === 'ativa' || mission.status === 'pausada') && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingMission}
                    onClick={async () => {
                      setWorkingMission(true)
                      setMissionError('')
                      try {
                        const result = await updateTestMission(mission.mission_id, 'cancel')
                        setMissions((prev) =>
                          prev.map((m) =>
                            m.mission_id === result.mission_id
                              ? { ...m, status: result.status }
                              : m,
                          ),
                        )
                        setMissionMessage(`Missão ${result.status} · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setMissionError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingMission(false)
                      }
                    }}
                  >
                    Cancelar
                  </Button>
                )}
                {mission.status === 'cancelada' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingMission}
                    onClick={async () => {
                      setWorkingMission(true)
                      setMissionError('')
                      try {
                        const result = await updateTestMission(mission.mission_id, 'reopen')
                        setMissions((prev) =>
                          prev.map((m) =>
                            m.mission_id === result.mission_id
                              ? { ...m, status: result.status }
                              : m,
                          ),
                        )
                        setMissionMessage(`Missão ${result.status} · evento ${result.event_type}`)
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setMissionError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingMission(false)
                      }
                    }}
                  >
                    Reabrir
                  </Button>
                )}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={workingMission}
                  onClick={async () => {
                    setWorkingMission(true)
                    setMissionError('')
                    try {
                      setMissionTimeline(await getMissionTimeline(mission.mission_id))
                      setMissionTimelineFor(mission.mission_id)
                    } catch (requestError) {
                      const err = requestError as {
                        response?: { error?: string }
                        data?: { error?: string }
                      }
                      const errorBody = err?.response ?? err?.data ?? {}
                      setMissionError(errorBody.error ?? getErrorMessage(requestError))
                    } finally {
                      setWorkingMission(false)
                    }
                  }}
                >
                  Ver linha do tempo
                </Button>
              </div>
              {missionTimelineFor === mission.mission_id && (
                <ol className="mt-4 space-y-2 border-l border-slate-700 pl-4 text-sm text-slate-300">
                  {missionTimeline.map((item) => (
                    <li key={item.id}>
                      <span className="font-medium text-cyan-300">{item.event_type}</span>
                      {' · '}
                      <span className="text-slate-400">
                        {item.before_status} → {item.after_status} · {item.created} · ator{' '}
                        {item.actor_id} · request {item.request_id}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Vínculos missão–participante</h2>
          <p className="mt-1 text-sm text-slate-400">
            Associa manualmente participantes do seu tenant a uma missão do seu tenant. Sem
            prontidão, convite ou composição automática. O participante vinculado verá somente a
            visão compartilhada desta missão. Campanha de grupo (F2-T05): a missão de grupo aceita
            vínculos até 6 participantes ativos; abaixo de 3 o grupo aparece como incompleto.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              size="small"
              variant="secondary"
              disabled={workingLink}
              onClick={async () => {
                setWorkingLink(true)
                setLinkError('')
                try {
                  setTenantParticipants(await listTenantParticipants())
                  setLinks(await listTenantMissionLinks())
                } catch (requestError) {
                  const err = requestError as {
                    response?: { error?: string }
                    data?: { error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setLinkError(errorBody.error ?? getErrorMessage(requestError))
                } finally {
                  setWorkingLink(false)
                }
              }}
            >
              {workingLink ? 'Carregando…' : 'Listar participantes e vínculos do tenant'}
            </Button>
          </div>
          {missions
            .filter((m) => m.modality === 'grupo')
            .map((mission) => {
              const activeCount = links.filter(
                (l) => l.mission_id === mission.mission_id && l.status === 'active',
              ).length
              const incomplete = mission.group_min ? activeCount < mission.group_min : false
              return (
                <p key={mission.mission_id} className="mt-2 text-xs text-slate-400">
                  {mission.title}: {activeCount}/{mission.group_max ?? 6} participantes ativos
                  {incomplete ? ` · grupo incompleto (mínimo ${mission.group_min})` : ''}
                  {activeCount >= (mission.group_max ?? 6) ? ' · campanha cheia' : ''}
                </p>
              )
            })}
          <form
            className="mt-4 grid gap-4 sm:grid-cols-2"
            onSubmit={async (event) => {
              event.preventDefault()
              setLinkError('')
              setLinkMessage('')
              setWorkingLink(true)
              try {
                const result = await createTestMissionLink(linkMissionId, linkParticipantId)
                setLinks((prev) => [
                  {
                    link_id: result.link_id,
                    mission_id: result.mission_id,
                    participant_id: result.participant_id,
                    status: result.status,
                    linked_by: result.linked_by,
                    created_at: result.created_at,
                    request_id: result.request_id,
                  },
                  ...prev.filter((l) => l.link_id !== result.link_id),
                ])
                setLinkMessage(
                  result.already_linked
                    ? 'Vínculo já existia para este par (idempotente).'
                    : 'Participante vinculado à missão · evento registrado',
                )
              } catch (requestError) {
                const err = requestError as {
                  response?: { error?: string }
                  data?: { error?: string }
                }
                const errorBody = err?.response ?? err?.data ?? {}
                setLinkError(errorBody.error ?? getErrorMessage(requestError))
              } finally {
                setWorkingLink(false)
              }
            }}
          >
            <label className="block text-sm font-medium text-slate-200">
              Missão do tenant
              <select
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={linkMissionId}
                onChange={(event) => setLinkMissionId(event.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {missions.map((mission) => (
                  <option key={mission.mission_id} value={mission.mission_id}>
                    {mission.title} ({mission.status})
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Participante do tenant
              <select
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"
                value={linkParticipantId}
                onChange={(event) => setLinkParticipantId(event.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {tenantParticipants.map((participant) => (
                  <option key={participant.participant_id} value={participant.participant_id}>
                    {participant.display_name} ({participant.contact_key})
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={workingLink}>
                {workingLink ? 'Vinculando…' : 'Vincular participante à missão'}
              </Button>
            </div>
          </form>
          {linkError && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {linkError}
            </p>
          )}
          {linkMessage && (
            <p className="mt-3 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
              {linkMessage}
            </p>
          )}
          {links.map((link) => (
            <article
              key={link.link_id}
              className="mt-4 rounded-2xl border border-slate-800 bg-slate-950 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {missions.find((m) => m.mission_id === link.mission_id)?.title ??
                      link.mission_id}
                  </h3>
                  <p className="text-xs text-slate-400">
                    participante{' '}
                    {tenantParticipants.find((p) => p.participant_id === link.participant_id)
                      ?.display_name ?? link.participant_id}
                  </p>
                </div>
                <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {link.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {link.status === 'active' && (
                  <Button
                    size="small"
                    variant="secondary"
                    disabled={workingLink}
                    onClick={async () => {
                      setWorkingLink(true)
                      setLinkError('')
                      try {
                        const result = await removeTestMissionLink(link.link_id)
                        setLinks((prev) =>
                          prev.map((l) =>
                            l.link_id === result.link_id ? { ...l, status: result.status } : l,
                          ),
                        )
                        setLinkMessage('Vínculo desfeito · evento registrado')
                      } catch (requestError) {
                        const err = requestError as {
                          response?: { error?: string }
                          data?: { error?: string }
                        }
                        const errorBody = err?.response ?? err?.data ?? {}
                        setLinkError(errorBody.error ?? getErrorMessage(requestError))
                      } finally {
                        setWorkingLink(false)
                      }
                    }}
                  >
                    Desvincular
                  </Button>
                )}
                <Button
                  size="small"
                  variant="secondary"
                  disabled={workingLink}
                  onClick={async () => {
                    setWorkingLink(true)
                    setLinkError('')
                    try {
                      setLinkTimeline(await getLinkTimeline(link.link_id))
                      setLinkTimelineFor(link.link_id)
                    } catch (requestError) {
                      const err = requestError as {
                        response?: { error?: string }
                        data?: { error?: string }
                      }
                      const errorBody = err?.response ?? err?.data ?? {}
                      setLinkError(errorBody.error ?? getErrorMessage(requestError))
                    } finally {
                      setWorkingLink(false)
                    }
                  }}
                >
                  Ver linha do tempo
                </Button>
              </div>
              {linkTimelineFor === link.link_id && (
                <ol className="mt-4 space-y-2 border-l border-slate-700 pl-4 text-sm text-slate-300">
                  {linkTimeline.map((item) => (
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
          <h2 className="text-lg font-semibold">Demonstração de acesso isolado (F1-T09)</h2>
          <p className="mt-1 text-sm text-slate-400">
            A sonda tenta vincular um participante de outro tenant à missão selecionada. O servidor
            nega, registra auditoria e não revela o alvo. Nenhum vínculo é criado.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <select
              className="w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              value={linkMissionId}
              onChange={(event) => setLinkMissionId(event.target.value)}
            >
              <option value="">Selecione a missão da sonda…</option>
              {missions.map((mission) => (
                <option key={mission.mission_id} value={mission.mission_id}>
                  {mission.title} ({mission.status})
                </option>
              ))}
            </select>
            <Button
              disabled={probingLink || !linkMissionId}
              onClick={async () => {
                setProbingLink(true)
                setProbeResult(null)
                try {
                  const result = await probeCrossTenantLink(linkMissionId)
                  setProbeResult({
                    outcome: result.outcome ?? 'allowed',
                    rule_id: result.rule_id,
                    audit_event_id: result.audit_event_id,
                  })
                } catch (requestError) {
                  const err = requestError as {
                    response?: { rule_id?: string; audit_event_id?: string; error?: string }
                    data?: { rule_id?: string; audit_event_id?: string; error?: string }
                  }
                  const errorBody = err?.response ?? err?.data ?? {}
                  setProbeResult({
                    outcome: 'denied',
                    rule_id: errorBody.rule_id,
                    audit_event_id: errorBody.audit_event_id,
                    error: errorBody.error ?? getErrorMessage(requestError),
                  })
                } finally {
                  setProbingLink(false)
                }
              }}
            >
              {probingLink ? 'Consultando…' : 'Tentar vínculo cross-tenant'}
            </Button>
            {probeResult && (
              <span
                className={
                  probeResult.outcome === 'allowed'
                    ? 'rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-200'
                    : 'rounded-full bg-red-950 px-3 py-1 text-xs text-red-200'
                }
              >
                {probeResult.outcome === 'allowed'
                  ? 'permitido'
                  : `negado · ${probeResult.rule_id || 'sem regra'}`}
              </span>
            )}
          </div>
          {probeResult?.audit_event_id && (
            <p className="mt-3 text-xs text-slate-400">
              Auditoria registrada: {probeResult.audit_event_id}
            </p>
          )}
          {probeResult?.error && (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {probeResult.error}
            </p>
          )}
        </section>
      </div>
    </main>
  )
}

const ParticipantMissionView = ({
  user,
  onSignOut,
}: {
  user: { name?: string; email?: string; test_role?: string; tenant_id?: string }
  onSignOut: () => void
}) => {
  const [view, setView] = useState<ParticipantMissionView | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    void getParticipantMissionView()
      .then((result) => {
        if (active) setView(result)
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
      <div className="mx-auto max-w-3xl">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Lunáticos · acesso protegido
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Minhas missões</h1>
            <p className="mt-3 text-sm text-slate-300">
              Sessão ativa para {user.name || user.email} ·{' '}
              {roleLabels[user.test_role || ''] || user.test_role} · build {APP_VERSION}
            </p>
          </div>
          <Button variant="outline" onClick={onSignOut}>
            Sair
          </Button>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-lg font-semibold">Visão compartilhada das missões vinculadas</h2>
          <p className="mt-1 text-sm text-slate-400">
            O servidor devolve somente as missões com vínculo ativo do seu participante, com campos
            compartilhados. Sem vínculo, nada é revelado.
          </p>
          {loading && <p className="mt-4 text-sm text-slate-300">Carregando visão autorizada…</p>}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-900 bg-red-950/60 p-3 text-sm text-red-200"
            >
              {error}
            </p>
          )}
          {!loading && !error && view && (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-300">
                Participante: {view.participant.display_name} · tenant {view.participant.tenant_id}
              </p>
              {view.missions.length === 0 && (
                <p className="rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
                  Nenhuma missão vinculada a este participante. Sem vínculo, nenhum conteúdo é
                  revelado.
                </p>
              )}
              {view.missions.map((mission) => (
                <article
                  key={mission.mission_id}
                  className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-100">{mission.title}</h3>
                      <p className="text-xs text-slate-400">
                        {mission.modality} · {mission.objective}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                      {mission.status}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">vínculo desde {mission.linked_at}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
          <p className="text-sm leading-6 text-cyan-100">
            Esta visão é calculada server-side pela associação real da sessão. Campos privados de
            outros participantes e missões de outros tenants nunca são devolvidos.
          </p>
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

  if (user.test_role === 'participant') {
    return <ParticipantMissionView user={user} onSignOut={signOut} />
  }

  return <ProtectedTestAccess user={user} onSignOut={signOut} />
}

export default Index
