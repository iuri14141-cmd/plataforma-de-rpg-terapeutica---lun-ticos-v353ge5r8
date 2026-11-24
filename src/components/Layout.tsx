import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import AppShellNav from '@/components/AppShellNav'
import { Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <AppShellNav />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-2 md:hidden">
          <span className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Lunáticos
          </span>
          <nav className="ml-auto flex items-center gap-2" aria-label="Navegação principal">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Início</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/clientes">Clientes</Link>
            </Button>
          </nav>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
