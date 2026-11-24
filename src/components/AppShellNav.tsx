import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/', label: 'Início' },
  { to: '/clientes', label: 'Clientes' },
]

export default function AppShellNav() {
  const location = useLocation()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => setLoaded(true), [])

  return (
    <div
      className={cn(
        'hidden w-60 shrink-0 border-r border-slate-800 bg-slate-950/80 p-5 md:block',
        'transition-opacity duration-300',
        loaded ? 'opacity-100' : 'opacity-0',
      )}
    >
      <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
        Lunáticos
      </p>
      <nav className="space-y-1" aria-label="Navegação principal">
        {NAV_ITEMS.map((item) => {
          const active =
            item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-slate-800 font-medium text-slate-100'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <p className="mt-8 text-xs leading-5 text-slate-500">
        Plataforma de RPG terapêutica · ambiente seguro
      </p>
    </div>
  )
}
