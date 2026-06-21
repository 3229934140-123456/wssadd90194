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

export function generateSegmentsFromTempData(
  waybillId: string,
  tempData: TemperaturePoint[],
  tempMin: number,
  tempMax: number,
  stops: StopPoint[] = []
): TemperatureSegment[] {
  if (tempData.length === 0) return []

  const segments: TemperatureSegment[] = []
  let segStart = 0
  let wasOverTemp = tempData[0].temperature > tempMax || tempData[0].temperature < tempMin

  for (let i = 1; i < tempData.length; i++) {
    const isOverTemp = tempData[i].temperature > tempMax || tempData[i].temperature < tempMin
    if (isOverTemp !== wasOverTemp || i === tempData.length - 1) {
      const endIdx = i === tempData.length - 1 ? i : i - 1
      const slice = tempData.slice(segStart, endIdx + 1)
      const temps = slice.map((p) => p.temperature)
      const segStartTs = new Date(slice[0].timestamp).getTime()
      const segEndTs = new Date(slice[slice.length - 1].timestamp).getTime()
      const segMidTs = (segStartTs + segEndTs) / 2

      let location = '运输途中'
      let locationType: LocationType = 'highway'

      if (wasOverTemp && stops.length > 0) {
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
          if (hasOverlap || dist < bestDist) {
            if (hasOverlap || dist < (tempData.length > 100 ? 600000 : 1200000)) {
              bestDist = hasOverlap ? -1 : dist
              bestStop = sp
            }
          }
        }
        if (bestStop) {
          location = bestStop.locationName
          locationType = bestStop.locationType
        }
      } else if (!wasOverTemp && stops.length > 0) {
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

      segments.push({
        id: `${waybillId}-seg-${segments.length}`,
        waybillId,
        startTime: slice[0].timestamp,
        endTime: slice[slice.length - 1].timestamp,
        minTemp: Math.min(...temps),
        maxTemp: Math.max(...temps),
        avgTemp: Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10,
        location,
        locationType,
        verdict: wasOverTemp ? null : 'acceptable',
        note: '',
        isOverTemp: wasOverTemp,
      })
      segStart = i
      wasOverTemp = isOverTemp
    }
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
