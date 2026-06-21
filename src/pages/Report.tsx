import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, FileBadge, Shield, Download, Eye, Save } from 'lucide-react'
import { useStore } from '@/store'
import type { AuditReport, TemplateType } from '@/types'
import { TEMPLATE_TYPE_LABELS, VERDICT_LABELS } from '@/types'
import { formatDateTime, generateId } from '@/utils/parsers'

const TEMPLATE_CARDS: { type: TemplateType; icon: typeof FileText; desc: string }[] = [
  { type: 'simplified', icon: FileText, desc: '适用于常规运输，简明记录关键异常' },
  { type: 'full', icon: FileBadge, desc: '包含全部温度段、停靠点详情和责任方回复' },
  { type: 'compliance', icon: Shield, desc: '符合 GSP 规范，含放行建议和复核签字栏' },
]

const RELEASE_OPTIONS = [
  { value: 'conditional_release', label: '有条件放行' },
  { value: 'reject', label: '拒绝放行' },
  { value: 'full_release', label: '完全放行' },
] as const

export default function Report() {
  const { waybillId } = useParams<{ waybillId: string }>()

  const waybills = useStore((s) => s.waybills)
  const getWaybillSegments = useStore((s) => s.getWaybillSegments)
  const getWaybillReport = useStore((s) => s.getWaybillReport)
  const addReport = useStore((s) => s.addReport)
  const updateWaybillStatus = useStore((s) => s.updateWaybillStatus)

  const waybill = waybills.find((w) => w.id === waybillId)
  const segments = getWaybillSegments(waybillId ?? '')
  const existingReport = getWaybillReport(waybillId ?? '')

  const overTempSegments = useMemo(
    () => segments.filter((s) => s.isOverTemp),
    [segments]
  )

  const autoAnomalySummary = useMemo(() => {
    if (overTempSegments.length === 0) return '全程温度在规定范围内，未检测到超温异常。'
    const lines = overTempSegments.map((s, i) => {
      const start = formatDateTime(s.startTime)
      const end = formatDateTime(s.endTime)
      return `第${i + 1}段：${s.location}（${start} 至 ${end}），最高温度${s.maxTemp}°C，最低温度${s.minTemp}°C，平均温度${s.avgTemp}°C`
    })
    return `运输过程中检测到${overTempSegments.length}段超温异常：${lines.join('；')}。`
  }, [overTempSegments])

  const [templateType, setTemplateType] = useState<TemplateType>(
    existingReport?.templateType ?? 'full'
  )
  const [batchNumber, setBatchNumber] = useState(waybill?.batchNumber ?? '')
  const [route, setRoute] = useState(waybill?.route ?? '')
  const [anomalyDescription, setAnomalyDescription] = useState(
    existingReport?.anomalyDescription ?? autoAnomalySummary
  )
  const [responsibleReply, setResponsibleReply] = useState(
    existingReport?.responsibleReply ?? ''
  )
  const [releaseRecommendation, setReleaseRecommendation] = useState(
    existingReport?.releaseRecommendation ?? (overTempSegments.length === 0 ? 'full_release' : '')
  )
  const [auditorName, setAuditorName] = useState(existingReport?.auditorName ?? '')
  const [reviewName, setReviewName] = useState(existingReport?.reviewName ?? '')
  const [showPreview, setShowPreview] = useState(false)

  if (!waybill) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        未找到运单信息
      </div>
    )
  }

  const handleSave = () => {
    const report: AuditReport = {
      id: existingReport?.id ?? generateId(),
      waybillId: waybill.id,
      templateType,
      anomalyDescription,
      responsibleReply,
      releaseRecommendation,
      auditorName,
      reviewName,
      generatedAt: new Date().toISOString(),
    }
    addReport(report)
    updateWaybillStatus(waybill.id, 'reported')
  }

  const handleExportPdf = () => {
    window.print()
  }

  const releaseLabel =
    RELEASE_OPTIONS.find((o) => o.value === releaseRecommendation)?.label ?? ''

  return (
    <div className="h-full flex flex-col overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Waybill Info Header */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur-sm">
          <h1 className="mb-4 text-lg font-semibold text-frost-300">运单信息</h1>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <span className="text-xs text-slate-500">运单号</span>
              <p className="mt-1 font-mono text-sm text-slate-200">{waybill.waybillNumber}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">批号</span>
              <p className="mt-1 font-mono text-sm text-slate-200">{waybill.batchNumber}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">路线</span>
              <p className="mt-1 text-sm text-slate-200">{waybill.route}</p>
            </div>
            <div>
              <span className="text-xs text-slate-500">承运商</span>
              <p className="mt-1 text-sm text-slate-200">{waybill.carrier}</p>
            </div>
          </div>
        </div>

        {/* Template Selection */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur-sm">
          <h2 className="mb-4 text-lg font-semibold text-frost-300">报告模板</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {TEMPLATE_CARDS.map(({ type, icon: Icon, desc }) => {
              const selected = templateType === type
              return (
                <button
                  key={type}
                  onClick={() => setTemplateType(type)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    selected
                      ? 'border-frost-400 bg-frost-950/40 shadow-[0_0_12px_rgba(56,189,248,0.15)]'
                      : 'border-slate-700/50 bg-slate-800/40 hover:border-slate-600'
                  }`}
                >
                  <Icon
                    className={`mb-2 h-6 w-6 ${
                      selected ? 'text-frost-400' : 'text-slate-500'
                    }`}
                  />
                  <p
                    className={`text-sm font-medium ${
                      selected ? 'text-frost-300' : 'text-slate-300'
                    }`}
                  >
                    {TEMPLATE_TYPE_LABELS[type]}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{desc}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Report Form */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-5 backdrop-blur-sm">
          <h2 className="mb-4 text-lg font-semibold text-frost-300">报告内容</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">批号</label>
                <input
                  type="text"
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">路线</label>
                <input
                  type="text"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">异常说明</label>
              <textarea
                rows={4}
                value={anomalyDescription}
                onChange={(e) => setAnomalyDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500 resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">责任方回复</label>
              <textarea
                rows={3}
                value={responsibleReply}
                onChange={(e) => setResponsibleReply(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500 resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-500">放行建议</label>
              <select
                value={releaseRecommendation}
                onChange={(e) => setReleaseRecommendation(e.target.value)}
                className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500"
              >
                <option value="">请选择</option>
                {RELEASE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">稽核员</label>
                <input
                  type="text"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">复核人</label>
                <input
                  type="text"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700/50 bg-slate-800/60 px-3 py-2 text-sm text-slate-200 outline-none focus:border-frost-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Report Preview */}
        {showPreview && (
          <div
            id="report-preview"
            className="rounded-xl border border-slate-700/50 bg-white p-8 text-slate-900 backdrop-blur-sm print:border-0 print:p-0 print:shadow-none"
          >
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-wide">冷链运输稽核报告</h1>
              <p className="mt-1 text-sm text-slate-500">
                报告模板：{TEMPLATE_TYPE_LABELS[templateType]}
              </p>
            </div>

            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border border-slate-300">
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    运单号
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {waybill.waybillNumber}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    批号
                  </td>
                  <td className="border border-slate-300 px-3 py-2">{batchNumber}</td>
                </tr>
                <tr className="border border-slate-300">
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    路线
                  </td>
                  <td className="border border-slate-300 px-3 py-2">{route}</td>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    承运商
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {waybill.carrier}
                  </td>
                </tr>
                <tr className="border border-slate-300">
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    发车时间
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {formatDateTime(waybill.departureTime)}
                  </td>
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    到达时间
                  </td>
                  <td className="border border-slate-300 px-3 py-2">
                    {formatDateTime(waybill.arrivalTime)}
                  </td>
                </tr>
                <tr className="border border-slate-300">
                  <td className="border border-slate-300 bg-slate-50 px-3 py-2 font-medium">
                    规定温度范围
                  </td>
                  <td className="border border-slate-300 px-3 py-2" colSpan={3}>
                    {waybill.temperatureRangeMin}°C ~ {waybill.temperatureRangeMax}°C
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6">
              <h2 className="mb-2 text-base font-semibold">异常说明</h2>
              <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                {anomalyDescription || '无'}
              </p>
            </div>

            <div className="mt-4">
              <h2 className="mb-2 text-base font-semibold">责任方回复</h2>
              <p className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                {responsibleReply || '待填写'}
              </p>
            </div>

            <div className="mt-6">
              <h2 className="mb-2 text-base font-semibold">温度段判定</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left font-medium">
                      时间段
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-left font-medium">
                      地点
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-medium">
                      最低
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-medium">
                      最高
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-medium">
                      平均
                    </th>
                    <th className="border border-slate-300 px-3 py-2 text-center font-medium">
                      判定
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((seg) => (
                    <tr key={seg.id}>
                      <td className="border border-slate-300 px-3 py-2 text-xs">
                        {formatDateTime(seg.startTime)}
                        <br />
                        {formatDateTime(seg.endTime)}
                      </td>
                      <td className="border border-slate-300 px-3 py-2">{seg.location}</td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        {seg.minTemp}°C
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        {seg.maxTemp}°C
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-center">
                        {seg.avgTemp}°C
                      </td>
                      <td
                        className={`border border-slate-300 px-3 py-2 text-center font-medium ${
                          seg.isOverTemp
                            ? seg.verdict === 'unqualified'
                              ? 'text-red-600'
                              : 'text-amber-600'
                            : 'text-green-700'
                        }`}
                      >
                        {seg.verdict ? VERDICT_LABELS[seg.verdict] : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h2 className="mb-2 text-base font-semibold">放行建议</h2>
              <p className="rounded border border-slate-200 bg-slate-50 p-3 text-sm font-medium">
                {releaseLabel || '待确定'}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-8">
              <div>
                <p className="text-sm font-medium">稽核员签字</p>
                <div className="mt-8 border-b border-slate-400" />
                <p className="mt-1 text-xs text-slate-500">{auditorName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">复核人签字</p>
                <div className="mt-8 border-b border-slate-400" />
                <p className="mt-1 text-xs text-slate-500">{reviewName}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 rounded-xl border border-slate-700/50 bg-slate-900/80 px-5 py-3 backdrop-blur-md">
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? '隐藏预览' : '预览报告'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!showPreview}
            className="flex items-center gap-2 rounded-lg border border-frost-600/50 bg-frost-900/40 px-4 py-2 text-sm text-frost-300 transition-colors hover:bg-frost-800/40 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            导出 PDF
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-lg bg-frost-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-frost-500"
          >
            <Save className="h-4 w-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
