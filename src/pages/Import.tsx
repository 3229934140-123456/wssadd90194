import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  MapPin,
  Camera,
  AlertTriangle,
  Plus,
  ArrowRight,
  X,
  CheckCircle2,
} from 'lucide-react'
import { useStore } from '@/store'
import {
  identifyFileType,
  parseTemperatureCsv,
  parseGpsCsv,
  generateSegmentsFromTempData,
  generateStopPointsFromGps,
  formatFileSize,
  formatDateTime,
  generateId,
  extractWaybillNumber,
} from '@/utils/parsers'
import {
  FILE_TYPE_LABELS,
  REQUIRED_FILE_TYPES,
} from '@/types'
import type { FileType, UploadedFile, Waybill } from '@/types'

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.kml', '.jpg', '.jpeg', '.png']
const ACCEPTED_MIME_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.google-earth.kml+xml',
  'image/jpeg',
  'image/png',
]

function fileTypeIcon(fileType: FileType) {
  switch (fileType) {
    case 'temperature_record':
      return <FileText className="w-4 h-4 text-sky-400" />
    case 'gps_track':
      return <MapPin className="w-4 h-4 text-emerald-400" />
    case 'departure_photo':
    case 'arrival_photo':
    case 'signature_photo':
      return <Camera className="w-4 h-4 text-violet-400" />
  }
}

function fileTypeTagColor(fileType: FileType) {
  switch (fileType) {
    case 'temperature_record':
      return 'bg-sky-500/20 text-sky-300 border-sky-500/30'
    case 'gps_track':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
    case 'departure_photo':
      return 'bg-violet-500/20 text-violet-300 border-violet-500/30'
    case 'arrival_photo':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'signature_photo':
      return 'bg-rose-500/20 text-rose-300 border-rose-500/30'
  }
}

export default function Import() {
  const navigate = useNavigate()
  const {
    waybills,
    files,
    addFile,
    addWaybill,
    updateWaybillStatus,
    setTemperatureData,
    setGpsData,
    setStopPoints,
    setSegments,
    stopPoints,
    temperatureData,
    gpsData,
  } = useStore()

  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const groupedFiles = groupFilesByWaybill(files, waybills)

  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const filesToProcess = Array.from(fileList).filter((f) => {
        const ext = '.' + f.name.split('.').pop()?.toLowerCase()
        return ACCEPTED_EXTENSIONS.includes(ext)
      })

      if (filesToProcess.length === 0) return

      setUploadingFiles(filesToProcess.map(() => generateId()))

      const affectedWaybillIds = new Set<string>()

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i]
        const fileType = identifyFileType(file.name)
        if (!fileType) continue

        const waybillNumber = extractWaybillNumber(file.name)
        let waybillId: string

        const existingWaybill = waybillNumber
          ? waybills.find((w) => w.waybillNumber === waybillNumber)
          : null

        if (existingWaybill) {
          waybillId = existingWaybill.id
        } else {
          waybillId = generateId()
          const newWaybill: Waybill = {
            id: waybillId,
            waybillNumber: waybillNumber || `YD-${Date.now()}`,
            batchNumber: '',
            route: '',
            carrier: '',
            departureTime: '',
            arrivalTime: '',
            status: 'draft',
            temperatureRangeMin: 2,
            temperatureRangeMax: 8,
          }
          addWaybill(newWaybill)
        }

        affectedWaybillIds.add(waybillId)

        const uploadedFile: UploadedFile = {
          id: generateId(),
          waybillId,
          fileType,
          fileName: file.name,
          fileSize: file.size,
          uploadTime: new Date().toISOString(),
          parseStatus: 'pending',
        }
        addFile(uploadedFile)

        if (fileType === 'temperature_record' && file.name.endsWith('.csv')) {
          try {
            const text = await file.text()
            const data = parseTemperatureCsv(text)
            if (data.length > 0) {
              setTemperatureData(waybillId, data)
            }
          } catch {
            /* parse error, skip */
          }
        }

        if (fileType === 'gps_track' && file.name.endsWith('.csv')) {
          try {
            const text = await file.text()
            const data = parseGpsCsv(text)
            if (data.length > 0) {
              setGpsData(waybillId, data)
              const stops = generateStopPointsFromGps(data)
              if (stops.length > 0) {
                setStopPoints(waybillId, stops)
              }
            }
          } catch {
            /* parse error, skip */
          }
        }
      }

      for (const wid of affectedWaybillIds) {
        const wb = useStore.getState().waybills.find((w) => w.id === wid)
        const td = useStore.getState().temperatureData[wid]
        const sp = useStore.getState().stopPoints[wid]
        if (wb && td && td.length > 0) {
          const segs = generateSegmentsFromTempData(
            wid,
            td,
            wb.temperatureRangeMin,
            wb.temperatureRangeMax,
            sp || []
          )
          setSegments(wid, segs)
        }
      }

      setUploadingFiles([])
    },
    [waybills, addFile, addWaybill, setTemperatureData, setGpsData, setStopPoints, setSegments]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      if (e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files)
      }
    },
    [processFiles]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files)
        e.target.value = ''
      }
    },
    [processFiles]
  )

  const handleStartVerify = useCallback(
    (waybillId: string) => {
      updateWaybillStatus(waybillId, 'imported')
      navigate(`/verify/${waybillId}`)
    },
    [updateWaybillStatus, navigate]
  )

  const handleMissingUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className="h-full flex flex-col gap-5 p-6 overflow-y-auto">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">文件导入</h1>
          <p className="text-sm text-slate-400 mt-1">
            拖拽或点击上传冷链运输文件，系统将自动识别类型并按运单分组
          </p>
        </div>
        <div className="text-xs text-slate-500">
          支持 .csv / .xlsx / .xls / .kml / .jpg / .png
        </div>
      </div>

      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative shrink-0 rounded-2xl border-2 border-dashed cursor-pointer
          transition-all duration-200 ease-out
          flex flex-col items-center justify-center gap-3 py-14
          ${
            isDragOver
              ? 'border-sky-400 bg-sky-500/10 shadow-[0_0_40px_rgba(14,165,233,0.2)]'
              : 'border-slate-600 hover:border-slate-500 bg-slate-900/30'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />
        <div
          className={`
            w-16 h-16 rounded-2xl flex items-center justify-center transition-colors
            ${isDragOver ? 'bg-sky-500/20' : 'bg-slate-800'}
          `}
        >
          <Upload
            className={`w-8 h-8 transition-colors ${
              isDragOver ? 'text-sky-400' : 'text-slate-400'
            }`}
          />
        </div>
        <div className="text-center">
          <p className={`text-lg font-medium ${isDragOver ? 'text-sky-300' : 'text-slate-300'}`}>
            {isDragOver ? '松开以上传文件' : '拖拽文件到此处，或点击选择'}
          </p>
          <p className="text-sm text-slate-500 mt-1">
            支持批量上传，系统自动识别温度记录、GPS轨迹、照片等文件类型
          </p>
        </div>
        {uploadingFiles.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-sky-400">
            <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            正在处理文件...
          </div>
        )}
      </div>

      {/* Waybill Cards */}
      {groupedFiles.length > 0 && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <h2 className="text-lg font-semibold text-white shrink-0">运单分组</h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {groupedFiles.map((group) => (
              <WaybillCard
                key={group.waybillId}
                waybillId={group.waybillId}
                waybillNumber={group.waybillNumber}
                files={group.files}
                onStartVerify={handleStartVerify}
                onMissingUpload={handleMissingUpload}
              />
            ))}
          </div>
        </div>
      )}

      {groupedFiles.length === 0 && files.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>尚未上传任何文件</p>
            <p className="text-sm mt-1">上传温度记录、GPS轨迹或照片文件开始</p>
          </div>
        </div>
      )}
    </div>
  )
}

interface WaybillGroup {
  waybillId: string
  waybillNumber: string
  files: UploadedFile[]
}

function groupFilesByWaybill(
  allFiles: UploadedFile[],
  allWaybills: Waybill[]
): WaybillGroup[] {
  const map = new Map<string, WaybillGroup>()

  for (const w of allWaybills) {
    map.set(w.id, {
      waybillId: w.id,
      waybillNumber: w.waybillNumber,
      files: [],
    })
  }

  for (const f of allFiles) {
    if (!map.has(f.waybillId)) {
      map.set(f.waybillId, {
        waybillId: f.waybillId,
        waybillNumber: f.waybillId,
        files: [],
      })
    }
    map.get(f.waybillId)!.files.push(f)
  }

  return Array.from(map.values()).filter((g) => g.files.length > 0)
}

interface WaybillCardProps {
  waybillId: string
  waybillNumber: string
  files: UploadedFile[]
  onStartVerify: (waybillId: string) => void
  onMissingUpload: () => void
}

function WaybillCard({
  waybillId,
  waybillNumber,
  files,
  onStartVerify,
  onMissingUpload,
}: WaybillCardProps) {
  const presentTypes = new Set(files.map((f) => f.fileType))
  const missingTypes = REQUIRED_FILE_TYPES.filter((t) => !presentTypes.has(t))
  const isComplete = missingTypes.length === 0

  return (
    <div className="glass-card rounded-2xl p-5 flex flex-col gap-4 frost-glow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
            <FileText className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">
              {waybillNumber}
            </h3>
            <p className="text-xs text-slate-400">
              {files.length} 个文件
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isComplete ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/15 rounded-full px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              材料齐全
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/15 rounded-full px-3 py-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              缺少 {missingTypes.length} 项
            </span>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="flex flex-col gap-2">
        {files.map((f) => (
          <div
            key={f.id}
            className="flex items-center gap-3 bg-slate-800/40 rounded-xl px-3 py-2.5"
          >
            {fileTypeIcon(f.fileType)}
            <span className="text-sm text-slate-200 flex-1 truncate">
              {f.fileName}
            </span>
            <span
              className={`text-xs border rounded-full px-2 py-0.5 ${fileTypeTagColor(
                f.fileType
              )}`}
            >
              {FILE_TYPE_LABELS[f.fileType]}
            </span>
            <span className="text-xs text-slate-500">
              {formatFileSize(f.fileSize)}
            </span>
          </div>
        ))}
      </div>

      {/* Missing Types */}
      {missingTypes.length > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-300 font-medium">缺少以下材料</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {missingTypes.map((type) => (
              <div
                key={type}
                className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5"
              >
                <span className="text-xs text-red-300">
                  {FILE_TYPE_LABELS[type]}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onMissingUpload()
                  }}
                  className="w-5 h-5 rounded-md bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3 h-3 text-red-300" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => onStartVerify(waybillId)}
        className={`
          w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium text-sm
          transition-all duration-200
          ${
            isComplete
              ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30'
              : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/60 border border-slate-600/30'
          }
        `}
      >
        开始核对
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
