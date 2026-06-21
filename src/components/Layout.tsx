import { useState } from 'react'
import { NavLink, useLocation, Outlet } from 'react-router-dom'
import {
  Snowflake,
  LayoutDashboard,
  Upload,
  PanelLeftClose,
  PanelLeftOpen,
  Database,
  RotateCcw,
} from 'lucide-react'
import { useStore } from '@/store'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '仪表盘' },
  { to: '/import', icon: Upload, label: '资料导入' },
]

const steps = [
  { key: 'import', label: '导入', route: '/import' },
  { key: 'verify', label: '核对', route: '/verify' },
  { key: 'report', label: '报告', route: '/report' },
]

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const loadDemoData = useStore((s) => s.loadDemoData)
  const resetStore = useStore((s) => s.resetStore)

  const currentStepIndex = steps.findIndex((s) =>
    location.pathname.startsWith(s.route)
  )

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside
        className={`${
          collapsed ? 'w-16' : 'w-64'
        } flex flex-col bg-slate-950/80 glass-panel transition-all duration-300 relative`}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-frost-500/20 bg-slate-800 text-frost-400 transition-colors hover:bg-slate-700"
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>

        <div className="flex items-center gap-3 border-b border-white/5 px-4 py-6">
          <Snowflake size={28} className="shrink-0 text-frost-400" />
          {!collapsed && (
            <span className="whitespace-nowrap text-lg font-semibold tracking-wide text-white">
              冷链稽核
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-frost-500/10 text-frost-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <item.icon size={20} className="shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="space-y-2 border-t border-white/5 px-2 py-4">
          <button
            onClick={loadDemoData}
            title="加载演示数据"
            className="flex w-full items-center gap-2 rounded-lg bg-frost-500/10 px-3 py-2 text-sm text-frost-300 transition-colors hover:bg-frost-500/20"
          >
            <Database size={16} className="shrink-0" />
            {!collapsed && <span>加载演示数据</span>}
          </button>
          <button
            onClick={resetStore}
            title="重置数据"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <RotateCcw size={16} className="shrink-0" />
            {!collapsed && <span>重置数据</span>}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center border-b border-white/5 bg-slate-950/40 px-6">
          <div className="flex items-center gap-2 text-sm">
            {steps.map((step, i) => {
              const isActive = currentStepIndex === i
              const isPast = currentStepIndex > i
              return (
                <div key={step.key} className="flex items-center gap-2">
                  {i > 0 && (
                    <span className={`mx-1 ${isPast ? 'text-frost-400' : 'text-slate-600'}`}>
                      →
                    </span>
                  )}
                  <span
                    className={`${
                      isActive
                        ? 'font-medium text-frost-400'
                        : isPast
                          ? 'text-frost-400/60'
                          : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
