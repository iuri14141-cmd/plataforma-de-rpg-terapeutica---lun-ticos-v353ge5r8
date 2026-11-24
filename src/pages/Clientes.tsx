import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getErrorMessage } from '@/lib/pocketbase/errors'
import { listCrmClients, type CrmClient } from '@/services/crmClients'

type LoadState = 'loading' | 'ready' | 'error'

function formatUpdatedAt(value: string): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Clientes() {
  const [state, setState] = useState<LoadState>('loading')
  const [clients, setClients] = useState<CrmClient[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const result = await listCrmClients()
      setClients(result.clients)
      setTotal(result.total)
      setState('ready')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
      setState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const term = search.trim().toLowerCase()
  const filtered = term
    ? clients.filter(
        (client) =>
          client.name.toLowerCase().includes(term) ||
          client.email.toLowerCase().includes(term) ||
          client.phone.toLowerCase().includes(term),
      )
    : clients

  return (
    <div className="px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 border-b border-slate-800 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Lunáticos · CRM
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
            <p className="mt-3 text-sm text-slate-300">
              Clientes cadastrados no seu CRM, carregados em tempo real pelo backend da plataforma.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={state === 'loading'}>
            {state === 'loading' ? 'Atualizando…' : 'Atualizar'}
          </Button>
        </header>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">
              Lista de clientes
              {state === 'ready' && (
                <span className="ml-2 text-sm font-normal text-slate-400">{total} no total</span>
              )}
            </h2>
            <Input
              className="w-full border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500 sm:max-w-xs"
              placeholder="Buscar por nome, e-mail ou telefone…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              disabled={state !== 'ready'}
            />
          </div>

          {state === 'loading' && (
            <div className="mt-6 space-y-3" role="status" aria-live="polite">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-10 animate-pulse rounded-lg bg-slate-800/60" />
              ))}
              <p className="text-sm text-slate-400">Carregando clientes do CRM…</p>
            </div>
          )}

          {state === 'error' && (
            <div
              role="alert"
              className="mt-6 rounded-lg border border-red-900 bg-red-950/60 p-4 text-sm text-red-200"
            >
              <p className="font-medium">Não foi possível carregar os clientes</p>
              <p className="mt-1">{error}</p>
              <Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {state === 'ready' && filtered.length === 0 && (
            <p className="mt-6 rounded-lg border border-amber-900 bg-amber-950/40 p-4 text-sm text-amber-100">
              {term
                ? 'Nenhum cliente encontrado com esse termo de busca.'
                : 'O CRM não retornou nenhum cliente cadastrado.'}
            </p>
          )}

          {state === 'ready' && filtered.length > 0 && (
            <div className="mt-6 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="text-right">Atualizado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="font-medium text-slate-100">{client.name}</TableCell>
                      <TableCell className="text-slate-300">
                        {client.email ? (
                          <a
                            className="hover:text-cyan-300 hover:underline"
                            href={`mailto:${client.email}`}
                          >
                            {client.email}
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {client.phone || <span className="text-slate-500">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-slate-400">
                        {formatUpdatedAt(client.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-cyan-900/60 bg-cyan-950/20 p-5">
          <p className="text-sm leading-6 text-cyan-100">
            Os dados vêm diretamente do CRM via backend da plataforma. A chave de acesso ao CRM fica
            apenas no servidor — o navegador nunca recebe nem envia credenciais.
          </p>
        </section>
      </div>
    </div>
  )
}
