import Papa from 'papaparse'
import type { TemperaturePoint, GpsPoint, FileType, LocationType } from '@/types'

export function identifyFileType(fileName: string): FileType | null {
  const ext = fileName.toLowerCase().split('.').pop()
  if (!ext) return null

  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    if (fileName.toLowerCase().includes('depart') || fileName.toLowerCase().includes('发车')) {
      return 'departure_photo'
    }
    if (fileName.toLowerCase().includes('arrival') || fileName.toLowerCase().includes('到货')) {
      return 'arrival_photo'
    }
    if (fileName.toLowerCase().includes('sign') || fileName.toLowerCase().includes('签收') || fileName.toLowerCase().includes('签字')) {
      return 'signature_photo'
    }
    return 'departure_photo'
  }

  if (fileName.toLowerCase().includes('gps') || fileName.toLowerCase().includes('track') || fileName.toLowerCase().includes('轨迹')) {
    return 'gps_track'
  }

  if (['csv', 'xlsx', 'xls'].includes(ext)) {
    return 'temperature_record'
  }

  if (ext === 'kml') {
    return 'gps_track'
  }

  return null
}

export function parseTemperatureCsv(csvText: string): TemperaturePoint[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (!result.data || result.data.length === 0) return []

  return result.data
    .map((row: Record<string, string>) => {
      const timestamp =
        row['timestamp'] || row['时间'] || row['time'] || row['datetime'] || row['日期时间'] || ''
      const temperature =
        parseFloat(row['temperature'] || row['温度'] || row['temp'] || row['值'] || 'NaN')
      if (!timestamp || isNaN(temperature)) return null
      return { timestamp, temperature }
    })
    .filter((p): p is TemperaturePoint => p !== null)
}

export function parseGpsCsv(csvText: string): GpsPoint[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  if (!result.data || result.data.length === 0) return []

  return result.data
    .map((row: Record<string, string>) => {
      const timestamp =
        row['timestamp'] || row['时间'] || row['time'] || row['datetime'] || ''
      const latitude = parseFloat(row['latitude'] || row['纬度'] || row['lat'] || 'NaN')
      const longitude = parseFloat(row['longitude'] || row['经度'] || row['lng'] || row['lon'] || 'NaN')
      const speed = parseFloat(row['speed'] || row['速度'] || '0')
      if (!timestamp || isNaN(latitude) || isNaN(longitude)) return null
      const isStopped = (isNaN(speed) ? 0 : speed) < 5
      const locationName = row['location'] || row['地点'] || row['name'] || undefined
      const locationType: LocationType | undefined = undefined
      const result: GpsPoint = {
        timestamp,
        latitude,
        longitude,
        speed: isNaN(speed) ? 0 : speed,
        isStopped,
      }
      if (locationName) result.locationName = locationName
      if (locationType) result.locationType = locationType
      return result
    })
    .filter((p): p is GpsPoint => p !== null)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1048576).toFixed(1) + ' MB'
}

export function formatDateTime(isoString: string): string {
  const d = new Date(isoString)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function extractWaybillNumber(fileName: string): string | null {
  const match = fileName.match(/YD[-_]?\d{4}[-_]?\d{4}/i)
  if (match) return match[0]
  const dateMatch = fileName.match(/\d{6,8}/)
  if (dateMatch) return 'YD-' + dateMatch[0]
  return null
}
