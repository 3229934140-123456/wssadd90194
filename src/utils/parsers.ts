import Papa from 'papaparse'
import type { TemperaturePoint, GpsPoint, StopPoint, TemperatureSegment, FileType, LocationType } from '@/types'

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

  const VALID_LOCATION_TYPES: LocationType[] = [
    'loading_area',
    'service_area',
    'vaccination_point',
    'highway',
    'other',
  ]

  const parseLocationType = (raw: string | undefined): LocationType | undefined => {
    if (!raw) return undefined
    const low = raw.trim().toLowerCase()
    if (VALID_LOCATION_TYPES.includes(low as LocationType)) {
      return low as LocationType
    }
    const labelMap: Record<string, LocationType> = {
      '装卸区': 'loading_area',
      '装车': 'loading_area',
      '卸货': 'loading_area',
      'loading': 'loading_area',
      '服务区': 'service_area',
      'service': 'service_area',
      '接种点': 'vaccination_point',
      '疾控': 'vaccination_point',
      'vaccination': 'vaccination_point',
      '高速': 'highway',
      'highway': 'highway',
      '其他': 'other',
      'other': 'other',
    }
    for (const k of Object.keys(labelMap)) {
      if (low.includes(k)) return labelMap[k]
    }
    return undefined
  }

  return result.data
    .map((row: Record<string, string>) => {
      const timestamp =
        row['timestamp'] || row['时间'] || row['time'] || row['datetime'] || ''
      const latitude = parseFloat(row['latitude'] || row['纬度'] || row['lat'] || 'NaN')
      const longitude = parseFloat(row['longitude'] || row['经度'] || row['lng'] || row['lon'] || 'NaN')
      const speed = parseFloat(row['speed'] || row['速度'] || '0')
      if (!timestamp || isNaN(latitude) || isNaN(longitude)) return null
      const isStopped = (isNaN(speed) ? 0 : speed) < 5
      const locationName = row['location'] || row['地点'] || row['name'] || row['location_name'] || undefined
      const locationTypeRaw =
        row['locationType'] ||
        row['location_type'] ||
        row['地点类型'] ||
        row['类型'] ||
        row['type'] ||
        undefined
      const locationType = parseLocationType(locationTypeRaw)
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

export function generateSegmentsFromTempData(
  waybillId: string,
  tempData: TemperaturePoint[],
  tempMin: number,
  tempMax: number,
  stops: StopPoint[] = []
): TemperatureSegment[] {
  if (tempData.length === 0) return []

  const isOverTemp = (t: number) => t > tempMax || t < tempMin

  const buildSegment = (
    startIdx: number,
    endIdx: number,
    overTempFlag: boolean
  ): TemperatureSegment => {
    const slice = tempData.slice(startIdx, endIdx + 1)
    const temps = slice.map((p) => p.temperature)
    const segStartTs = new Date(slice[0].timestamp).getTime()
    const segEndTs = new Date(slice[slice.length - 1].timestamp).getTime()
    const segMidTs = (segStartTs + segEndTs) / 2

    let location = '运输途中'
    let locationType: LocationType = 'highway'

    if (overTempFlag && stops.length > 0) {
      let bestStop: StopPoint | null = null
      let bestDist = Infinity
      for (const sp of stops) {
        const spStart = new Date(sp.startTime).getTime()
        const spEnd = new Date(sp.endTime).getTime()
        const spMid = (spStart + spEnd) / 2
        const dist = Math.abs(spMid - segMidTs)
        const overlapStart = Math.max(segStartTs, spStart)
        const overlapEnd = Math.min(segEndTs, spEnd)
        const hasOverlap = overlapEnd > overlapStart
        if (hasOverlap) {
          bestDist = -1
          bestStop = sp
          break
        }
        if (dist < bestDist && dist < (tempData.length > 100 ? 600000 : 1200000)) {
          bestDist = dist
          bestStop = sp
        }
      }
      if (bestStop) {
        location = bestStop.locationName
        locationType = bestStop.locationType
      }
    } else if (!overTempFlag && stops.length > 0) {
      for (const sp of stops) {
        const spStart = new Date(sp.startTime).getTime()
        const spEnd = new Date(sp.endTime).getTime()
        const overlapStart = Math.max(segStartTs, spStart)
        const overlapEnd = Math.min(segEndTs, spEnd)
        if (overlapEnd > overlapStart) {
          location = sp.locationName
          locationType = sp.locationType
          break
        }
      }
    }

    return {
      id: `${waybillId}-seg-${segments.length}`,
      waybillId,
      startTime: slice[0].timestamp,
      endTime: slice[slice.length - 1].timestamp,
      minTemp: Math.min(...temps),
      maxTemp: Math.max(...temps),
      avgTemp: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
      location,
      locationType,
      verdict: overTempFlag ? null : 'acceptable',
      note: '',
      isOverTemp: overTempFlag,
    }
  }

  const segments: TemperatureSegment[] = []
  let segStart = 0
  let currentOverTemp = isOverTemp(tempData[0].temperature)

  for (let i = 1; i < tempData.length; i++) {
    const thisOverTemp = isOverTemp(tempData[i].temperature)

    if (thisOverTemp !== currentOverTemp) {
      segments.push(buildSegment(segStart, i - 1, currentOverTemp))
      segStart = i
      currentOverTemp = thisOverTemp
    }

    if (i === tempData.length - 1) {
      segments.push(buildSegment(segStart, i, currentOverTemp))
    }
  }

  if (tempData.length === 1) {
    segments.push(buildSegment(0, 0, currentOverTemp))
  }

  return segments
}

export function generateStopPointsFromGps(gpsPoints: GpsPoint[]): StopPoint[] {
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
  return stops
}
