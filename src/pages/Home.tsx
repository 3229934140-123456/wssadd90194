import { FileText, Clock, CheckCircle, FileBadge, Inbox, ClipboardList } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '@/store'
import { WAYBILL_STATUS_LABELS } from '@/types'
import type { WaybillStatus } from '@/types'
import { formatDateTime } from '@/utils/parsers'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<WaybillStatus, string> = {
  draft: 'bg-slate-500/20 text-slate-300',
  imported: 'bg-cyan-500/20 text-cyan-300',
  verifying: 'bg-amber-500/20 text-amber-300',
  verified: 'bg-emerald-500/20 text-emerald-300',
  reported: 'bg-violet-500/20 text-violet-300',
}

const STATUS_DOT: Record<WaybillStatus, string> = {
  draft: 'bg-slate-400',
  imported: 'bg-cyan-400',
  verifying: 'bg-amber-400',
  verified: 'bg-emerald-400',
  reported: 'bg-violet-400',
}

export default function Home() {
  const waybills = useStore((s) => s.waybills)
  const loadDemoData = useStore((s) => s.loadDemoData)

  const total = waybills.length
  const imported = waybills.filter((w) => w.status === 'imported').length
  const verifying = waybills.filter((w) => w.status === 'verifying').length
  const verified = waybills.filter((w) => w.status === 'verified').length
  const reported = waybills.filter((w) => w.status === 'reported').length

  const stats = [
    { label: '运单总数', value: total, icon: FileText, color: 'text-frost-400', bg: 'bg-frost-500/10' },
    { label: '已导入', value: imported, icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: '核对中', value: verifying, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '已核对', value: verified, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: '已出报告', value: reported, icon: FileBadge, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-frost-400">
          稽核任务概览
        </h1>
        <p className="text-sm text-slate-400">
          冷链运输温度稽核管理系统 — 查看运单状态、执行曲线核对与生成稽核报告
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <div className={cn('rounded-lg p-1.5', s.bg)}>
                <s.icon className={cn('h-4 w-4', s.color)} />
              </div>
              <span className="text-xs text-slate-400">{s.label}</span>
            </div>
            <p className={cn('text-2xl font-semibold tabular-nums', s.color)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] backdrop-blur-md">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-white/[0.06]">
          <ClipboardList className="h-4 w-4 text-frost-400" />
          <h2 className="text-sm font-semibold text-slate-200">运单列表</h2>
        </div>

        {waybills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="rounded-full bg-slate-800/60 p-4">
              <Inbox className="h-8 w-8 text-slate-500" />
            </div>
            <p className="text-sm text-slate-500">暂无运单数据</p>
            <button
              onClick={loadDemoData}
              className="rounded-lg bg-frost-500 px-4 py-2 text-sm font-medium text-white hover:bg-frost-600 transition-colors"
            >
              加载演示数据
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-slate-400">
                  <th className="px-5 py-3 text-left font-medium">运单号</th>
                  <th className="px-5 py-3 text-left font-medium">批号</th>
                  <th className="px-5 py-3 text-left font-medium">路线</th>
                  <th className="px-5 py-3 text-left font-medium">承运商</th>
                  <th className="px-5 py-3 text-left font-medium">状态</th>
                  <th className="px-5 py-3 text-left font-medium">发车时间</th>
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {waybills.map((w) => (
                  <tr
                    key={w.id}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 font-mono text-frost-300">
                      {w.waybillNumber}
                    </td>
                    <td className="px-5 py-3 text-slate-300">{w.batchNumber}</td>
                    <td className="px-5 py-3 text-slate-300 max-w-[200px] truncate">
                      {w.route}
                    </td>
                    <td className="px-5 py-3 text-slate-300">{w.carrier}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          STATUS_BADGE[w.status]
                        )}
                      >
                        <span
                          className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[w.status])}
                        />
                        {WAYBILL_STATUS_LABELS[w.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {formatDateTime(w.departureTime)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/verify/${w.id}`}
                          className="rounded-md bg-frost-500/15 px-3 py-1 text-xs font-medium text-frost-300 hover:bg-frost-500/25 transition-colors"
                        >
                          曲线核对
                        </Link>
                        <Link
                          to={`/report/${w.id}`}
                          className="rounded-md bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/25 transition-colors"
                        >
                          稽核报告
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
