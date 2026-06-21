export type FileType =
  | 'temperature_record'
  | 'gps_track'
  | 'departure_photo'
  | 'arrival_photo'
  | 'signature_photo'

export type LocationType =
  | 'loading_area'
  | 'service_area'
  | 'vaccination_point'
  | 'highway'
  | 'other'

export type Verdict =
  | 'acceptable'
  | 'needs_explanation'
  | 'unqualified'

export type TemplateType = 'simplified' | 'full' | 'compliance'

export type WaybillStatus =
  | 'draft'
  | 'imported'
  | 'verifying'
  | 'verified'
  | 'reported'

export interface Waybill {
  id: string
  waybillNumber: string
  batchNumber: string
  route: string
  carrier: string
  departureTime: string
  arrivalTime: string
  status: WaybillStatus
  temperatureRangeMin: number
  temperatureRangeMax: number
}

export interface UploadedFile {
  id: string
  waybillId: string
  fileType: FileType
  fileName: string
  fileSize: number
  uploadTime: string
  parseStatus: 'pending' | 'success' | 'error'
}

export interface TemperaturePoint {
  timestamp: string
  temperature: number
}

export interface GpsPoint {
  timestamp: string
  latitude: number
  longitude: number
  speed: number
  isStopped: boolean
  locationName?: string
  locationType?: LocationType
}

export interface StopPoint {
  startTime: string
  endTime: string
  latitude: number
  longitude: number
  duration: number
  locationName: string
  locationType: LocationType
}

export interface TemperatureSegment {
  id: string
  waybillId: string
  startTime: string
  endTime: string
  minTemp: number
  maxTemp: number
  avgTemp: number
  location: string
  locationType: LocationType
  verdict: Verdict | null
  note: string
  isOverTemp: boolean
}

export interface AuditReport {
  id: string
  waybillId: string
  templateType: TemplateType
  anomalyDescription: string
  responsibleReply: string
  releaseRecommendation: string
  auditorName: string
  reviewName: string
  generatedAt: string
}

export const FILE_TYPE_LABELS: Record<FileType, string> = {
  temperature_record: '温度记录',
  gps_track: 'GPS 轨迹',
  departure_photo: '发车照片',
  arrival_photo: '到货照片',
  signature_photo: '签收照片',
}

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  loading_area: '装卸区',
  service_area: '服务区',
  vaccination_point: '接种点',
  highway: '高速路',
  other: '其他',
}

export const VERDICT_LABELS: Record<Verdict, string> = {
  acceptable: '可接受',
  needs_explanation: '需说明',
  unqualified: '不合格',
}

export const TEMPLATE_TYPE_LABELS: Record<TemplateType, string> = {
  simplified: '简化版',
  full: '完整版',
  compliance: '法规合规版',
}

export const WAYBILL_STATUS_LABELS: Record<WaybillStatus, string> = {
  draft: '草稿',
  imported: '已导入',
  verifying: '核对中',
  verified: '已核对',
  reported: '已出报告',
}

export const REQUIRED_FILE_TYPES: FileType[] = [
  'temperature_record',
  'gps_track',
  'departure_photo',
  'arrival_photo',
  'signature_photo',
]
