import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Waybill,
  UploadedFile,
  TemperaturePoint,
  GpsPoint,
  StopPoint,
  TemperatureSegment,
  AuditReport,
  WaybillStatus,
  Verdict,
  TemplateType,
  LocationType,
} from '@/types'

interface ColdChainStore {
  waybills: Waybill[]
  files: UploadedFile[]
  temperatureData: Record<string, TemperaturePoint[]>
  gpsData: Record<string, GpsPoint[]>
  stopPoints: Record<string, StopPoint[]>
  segments: TemperatureSegment[]
  reports: AuditReport[]

  addWaybill: (waybill: Waybill) => void
  updateWaybillStatus: (id: string, status: WaybillStatus) => void
  updateWaybill: (id: string, updates: Partial<Waybill>) => void
  removeWaybill: (id: string) => void

  addFile: (file: UploadedFile) => void
  removeFile: (id: string) => void

  setTemperatureData: (waybillId: string, data: TemperaturePoint[]) => void
  setGpsData: (waybillId: string, data: GpsPoint[]) => void
  setStopPoints: (waybillId: string, points: StopPoint[]) => void

  setSegments: (waybillId: string, segments: TemperatureSegment[]) => void
  updateSegmentVerdict: (segmentId: string, verdict: Verdict, note?: string) => void

  addReport: (report: AuditReport) => void
  updateReport: (id: string, updates: Partial<AuditReport>) => void

  getWaybillFiles: (waybillId: string) => UploadedFile[]
  getWaybillSegments: (waybillId: string) => TemperatureSegment[]
  getWaybillReport: (waybillId: string) => AuditReport | undefined

  loadDemoData: () => void
  resetStore: () => void
}

export const useStore = create<ColdChainStore>()(
  persist(
    (set, get) => ({
      waybills: [],
      files: [],
      temperatureData: {},
      gpsData: {},
      stopPoints: {},
      segments: [],
      reports: [],

      addWaybill: (waybill) =>
        set((state) => ({ waybills: [...state.waybills, waybill] })),

      updateWaybillStatus: (id, status) =>
        set((state) => ({
          waybills: state.waybills.map((w) =>
            w.id === id ? { ...w, status } : w
          ),
        })),

      updateWaybill: (id, updates) =>
        set((state) => ({
          waybills: state.waybills.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          ),
        })),

      removeWaybill: (id) =>
        set((state) => ({
          waybills: state.waybills.filter((w) => w.id !== id),
          files: state.files.filter((f) => f.waybillId !== id),
          segments: state.segments.filter((s) => s.waybillId !== id),
          reports: state.reports.filter((r) => r.waybillId !== id),
        })),

      addFile: (file) =>
        set((state) => ({ files: [...state.files, file] })),

      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
        })),

      setTemperatureData: (waybillId, data) =>
        set((state) => ({
          temperatureData: { ...state.temperatureData, [waybillId]: data },
        })),

      setGpsData: (waybillId, data) =>
        set((state) => ({
          gpsData: { ...state.gpsData, [waybillId]: data },
        })),

      setStopPoints: (waybillId, points) =>
        set((state) => ({
          stopPoints: { ...state.stopPoints, [waybillId]: points },
        })),

      setSegments: (waybillId, newSegments) =>
        set((state) => ({
          segments: [
            ...state.segments.filter((s) => s.waybillId !== waybillId),
            ...newSegments,
          ],
        })),

      updateSegmentVerdict: (segmentId, verdict, note) =>
        set((state) => ({
          segments: state.segments.map((s) =>
            s.id === segmentId
              ? { ...s, verdict, note: note ?? s.note }
              : s
          ),
        })),

      addReport: (report) =>
        set((state) => ({
          reports: [...state.reports.filter((r) => r.waybillId !== report.waybillId), report],
        })),

      updateReport: (id, updates) =>
        set((state) => ({
          reports: state.reports.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        })),

      getWaybillFiles: (waybillId) =>
        get().files.filter((f) => f.waybillId === waybillId),

      getWaybillSegments: (waybillId) =>
        get().segments.filter((s) => s.waybillId === waybillId),

      getWaybillReport: (waybillId) =>
        get().reports.find((r) => r.waybillId === waybillId),

      loadDemoData: () => {
        const now = new Date()
        const dayMs = 86400000

        const demoWaybills: Waybill[] = [
          {
            id: 'demo-1',
            waybillNumber: 'YD-2026-0601',
            batchNumber: '20260601A',
            route: '北京 → 石家庄 → 邢台',
            carrier: '中冷物流',
            departureTime: new Date(now.getTime() - 2 * dayMs).toISOString(),
            arrivalTime: new Date(now.getTime() - 2 * dayMs + 8 * 3600000).toISOString(),
            status: 'reported',
            temperatureRangeMin: 2,
            temperatureRangeMax: 8,
          },
          {
            id: 'demo-2',
            waybillNumber: 'YD-2026-0602',
            batchNumber: '20260602B',
            route: '上海 → 南京 → 合肥',
            carrier: '华运冷链',
            departureTime: new Date(now.getTime() - 1 * dayMs).toISOString(),
            arrivalTime: new Date(now.getTime() - 1 * dayMs + 6 * 3600000).toISOString(),
            status: 'verified',
            temperatureRangeMin: 2,
            temperatureRangeMax: 8,
          },
          {
            id: 'demo-3',
            waybillNumber: 'YD-2026-0603',
            batchNumber: '20260603C',
            route: '广州 → 长沙 → 武汉',
            carrier: '粤冷达运输',
            departureTime: new Date(now.getTime() - 0.5 * dayMs).toISOString(),
            arrivalTime: new Date(now.getTime() - 0.5 * dayMs + 10 * 3600000).toISOString(),
            status: 'verifying',
            temperatureRangeMin: 2,
            temperatureRangeMax: 8,
          },
        ]

        const baseTime = new Date(now.getTime() - 2 * dayMs)
        baseTime.setHours(6, 0, 0, 0)

        const demoTempData1: TemperaturePoint[] = []
        for (let i = 0; i < 480; i++) {
          const t = new Date(baseTime.getTime() + i * 60000)
          let temp = 3.5 + Math.sin(i / 60) * 1.2 + (Math.random() - 0.5) * 0.3
          if (i > 120 && i < 140) temp = 8.5 + Math.random() * 1.5
          if (i > 300 && i < 315) temp = 9.2 + Math.random() * 0.8
          demoTempData1.push({
            timestamp: t.toISOString(),
            temperature: Math.round(temp * 10) / 10,
          })
        }

        const baseTime2 = new Date(now.getTime() - 1 * dayMs)
        baseTime2.setHours(7, 0, 0, 0)

        const demoTempData2: TemperaturePoint[] = []
        for (let i = 0; i < 360; i++) {
          const t = new Date(baseTime2.getTime() + i * 60000)
          let temp = 4.0 + Math.sin(i / 80) * 0.8 + (Math.random() - 0.5) * 0.2
          if (i > 200 && i < 210) temp = 8.3 + Math.random() * 0.7
          demoTempData2.push({
            timestamp: t.toISOString(),
            temperature: Math.round(temp * 10) / 10,
          })
        }

        const baseTime3 = new Date(now.getTime() - 0.5 * dayMs)
        baseTime3.setHours(5, 0, 0, 0)

        const demoTempData3: TemperaturePoint[] = []
        for (let i = 0; i < 600; i++) {
          const t = new Date(baseTime3.getTime() + i * 60000)
          let temp = 3.8 + Math.sin(i / 50) * 1.0 + (Math.random() - 0.5) * 0.4
          if (i > 80 && i < 100) temp = 9.5 + Math.random() * 1.0
          if (i > 250 && i < 265) temp = 8.8 + Math.random() * 1.2
          if (i > 400 && i < 420) temp = 10.1 + Math.random() * 0.5
          demoTempData3.push({
            timestamp: t.toISOString(),
            temperature: Math.round(temp * 10) / 10,
          })
        }

        const makeGpsPoints = (base: Date, count: number): GpsPoint[] => {
          const points: GpsPoint[] = []
          const latStart = 39.9
          const lngStart = 116.4
          for (let i = 0; i < count; i++) {
            const t = new Date(base.getTime() + i * 60000)
            const progress = i / count
            const speed = Math.random() > 0.15 ? 60 + Math.random() * 40 : 0
            const isStopped = speed < 5
            points.push({
              timestamp: t.toISOString(),
              latitude: latStart + progress * 3 + (Math.random() - 0.5) * 0.01,
              longitude: lngStart + progress * -4 + (Math.random() - 0.5) * 0.01,
              speed: Math.round(speed),
              isStopped,
              locationName: isStopped
                ? ['装车仓库', '石家庄服务区', '邢台疾控中心'][Math.floor(Math.random() * 3)]
                : undefined,
              locationType: isStopped
                ? (['loading_area', 'service_area', 'vaccination_point'] as LocationType[])[
                    Math.floor(Math.random() * 3)
                  ]
                : undefined,
            })
          }
          return points
        }

        const demoGpsData1 = makeGpsPoints(baseTime, 480)
        const demoGpsData2 = makeGpsPoints(baseTime2, 360)
        const demoGpsData3 = makeGpsPoints(baseTime3, 600)

        const makeStopPoints = (gpsPoints: GpsPoint[]): StopPoint[] => {
          const stops: StopPoint[] = []
          let currentStop: GpsPoint[] = []
          for (const p of gpsPoints) {
            if (p.isStopped) {
              currentStop.push(p)
            } else if (currentStop.length > 0) {
              if (currentStop.length >= 3) {
                stops.push({
                  startTime: currentStop[0].timestamp,
                  endTime: currentStop[currentStop.length - 1].timestamp,
                  latitude: currentStop[0].latitude,
                  longitude: currentStop[0].longitude,
                  duration: currentStop.length,
                  locationName: currentStop[0].locationName || '未知地点',
                  locationType: currentStop[0].locationType || 'other',
                })
              }
              currentStop = []
            }
          }
          return stops
        }

        const demoStopPoints1 = makeStopPoints(demoGpsData1)
        const demoStopPoints2 = makeStopPoints(demoGpsData2)
        const demoStopPoints3 = makeStopPoints(demoGpsData3)

        const makeSegmentsFromData = (
          waybillId: string,
          tempData: TemperaturePoint[],
          tempMin: number,
          tempMax: number
        ): TemperatureSegment[] => {
          const segments: TemperatureSegment[] = []
          let segStart = 0
          let wasOverTemp = tempData[0].temperature > tempMax || tempData[0].temperature < tempMin

          for (let i = 1; i < tempData.length; i++) {
            const isOverTemp = tempData[i].temperature > tempMax || tempData[i].temperature < tempMin
            if (isOverTemp !== wasOverTemp || i === tempData.length - 1) {
              const endIdx = i === tempData.length - 1 ? i : i - 1
              const slice = tempData.slice(segStart, endIdx + 1)
              const temps = slice.map((p) => p.temperature)
              const locationTypes: LocationType[] = ['loading_area', 'service_area', 'vaccination_point', 'highway', 'other']
              segments.push({
                id: `${waybillId}-seg-${segments.length}`,
                waybillId,
                startTime: slice[0].timestamp,
                endTime: slice[slice.length - 1].timestamp,
                minTemp: Math.min(...temps),
                maxTemp: Math.max(...temps),
                avgTemp: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
                location: wasOverTemp
                  ? ['装卸区', '服务区', '接种点门口'][Math.floor(Math.random() * 3)]
                  : '运输途中',
                locationType: wasOverTemp
                  ? locationTypes[Math.floor(Math.random() * 3)]
                  : 'highway',
                verdict: null,
                note: '',
                isOverTemp: wasOverTemp,
              })
              segStart = i
              wasOverTemp = isOverTemp
            }
          }
          return segments
        }

        const demoSegments1 = makeSegmentsFromData('demo-1', demoTempData1, 2, 8)
        demoSegments1.forEach((s) => {
          if (s.isOverTemp) {
            s.verdict = s.maxTemp > 9.5 ? 'unqualified' : 'needs_explanation'
          } else {
            s.verdict = 'acceptable'
          }
        })

        const demoSegments2 = makeSegmentsFromData('demo-2', demoTempData2, 2, 8)
        demoSegments2.forEach((s) => {
          if (s.isOverTemp) {
            s.verdict = 'needs_explanation'
          } else {
            s.verdict = 'acceptable'
          }
        })

        const demoSegments3 = makeSegmentsFromData('demo-3', demoTempData3, 2, 8)

        const demoFiles: UploadedFile[] = [
          { id: 'f1', waybillId: 'demo-1', fileType: 'temperature_record', fileName: 'temp_record_0601.csv', fileSize: 24576, uploadTime: new Date(now.getTime() - 1.5 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f2', waybillId: 'demo-1', fileType: 'gps_track', fileName: 'gps_track_0601.csv', fileSize: 18432, uploadTime: new Date(now.getTime() - 1.5 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f3', waybillId: 'demo-1', fileType: 'departure_photo', fileName: 'departure_0601.jpg', fileSize: 3072000, uploadTime: new Date(now.getTime() - 1.5 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f4', waybillId: 'demo-1', fileType: 'arrival_photo', fileName: 'arrival_0601.jpg', fileSize: 2867200, uploadTime: new Date(now.getTime() - 1.5 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f5', waybillId: 'demo-1', fileType: 'signature_photo', fileName: 'signature_0601.jpg', fileSize: 1536000, uploadTime: new Date(now.getTime() - 1.5 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f6', waybillId: 'demo-2', fileType: 'temperature_record', fileName: 'temp_record_0602.csv', fileSize: 20480, uploadTime: new Date(now.getTime() - 0.8 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f7', waybillId: 'demo-2', fileType: 'gps_track', fileName: 'gps_track_0602.csv', fileSize: 16384, uploadTime: new Date(now.getTime() - 0.8 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f8', waybillId: 'demo-2', fileType: 'departure_photo', fileName: 'departure_0602.jpg', fileSize: 2560000, uploadTime: new Date(now.getTime() - 0.8 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f9', waybillId: 'demo-2', fileType: 'arrival_photo', fileName: 'arrival_0602.jpg', fileSize: 2739200, uploadTime: new Date(now.getTime() - 0.8 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f10', waybillId: 'demo-2', fileType: 'signature_photo', fileName: 'signature_0602.jpg', fileSize: 1843200, uploadTime: new Date(now.getTime() - 0.8 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f11', waybillId: 'demo-3', fileType: 'temperature_record', fileName: 'temp_record_0603.csv', fileSize: 30720, uploadTime: new Date(now.getTime() - 0.3 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f12', waybillId: 'demo-3', fileType: 'gps_track', fileName: 'gps_track_0603.csv', fileSize: 22528, uploadTime: new Date(now.getTime() - 0.3 * dayMs).toISOString(), parseStatus: 'success' },
          { id: 'f13', waybillId: 'demo-3', fileType: 'departure_photo', fileName: 'departure_0603.jpg', fileSize: 2867200, uploadTime: new Date(now.getTime() - 0.3 * dayMs).toISOString(), parseStatus: 'success' },
        ]

        const demoReport: AuditReport = {
          id: 'r1',
          waybillId: 'demo-1',
          templateType: 'full',
          anomalyDescription: '运输过程中出现两段超温：第一段发生在石家庄服务区停靠期间（08:20-08:40），最高温度9.7°C，持续20分钟；第二段发生在邢台装卸区（11:00-11:15），最高温度9.9°C，持续15分钟。',
          responsibleReply: '承运商确认石家庄服务区因冷藏车设备重启导致短暂升温，邢台装卸区因卸货开门时间过长。已加强设备巡检并缩短开门时长。',
          releaseRecommendation: 'conditional_release',
          auditorName: '张明',
          reviewName: '李华',
          generatedAt: new Date(now.getTime() - 1 * dayMs).toISOString(),
        }

        set({
          waybills: demoWaybills,
          files: demoFiles,
          temperatureData: {
            'demo-1': demoTempData1,
            'demo-2': demoTempData2,
            'demo-3': demoTempData3,
          },
          gpsData: {
            'demo-1': demoGpsData1,
            'demo-2': demoGpsData2,
            'demo-3': demoGpsData3,
          },
          stopPoints: {
            'demo-1': demoStopPoints1,
            'demo-2': demoStopPoints2,
            'demo-3': demoStopPoints3,
          },
          segments: [...demoSegments1, ...demoSegments2, ...demoSegments3],
          reports: [demoReport],
        })
      },

      resetStore: () =>
        set({
          waybills: [],
          files: [],
          temperatureData: {},
          gpsData: {},
          stopPoints: {},
          segments: [],
          reports: [],
        }),
    }),
    {
      name: 'cold-chain-audit-store',
      partialize: (state) => ({
        waybills: state.waybills,
        files: state.files,
        temperatureData: state.temperatureData,
        gpsData: state.gpsData,
        stopPoints: state.stopPoints,
        segments: state.segments,
        reports: state.reports,
      }),
    }
  )
)
