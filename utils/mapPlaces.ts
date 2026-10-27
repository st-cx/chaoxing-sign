import { isQrCoordinates } from './qrLocation'
export interface MapPlace { name: string; address: string; longitude: number; latitude: number; coordinateSystem: 'wgs84' | 'bd09' }
export function photonPlaces(body: any): MapPlace[] {
  if (!Array.isArray(body?.features)) return []
  return body.features.slice(0, 6).flatMap((feature: any) => {
    const coordinates = feature?.geometry?.coordinates
    const p = feature?.properties || {}
    const value = { longitude: coordinates?.[0], latitude: coordinates?.[1], coordinateSystem: 'wgs84' as const }
    if (!isQrCoordinates(value)) return []
    const parts = [p.country, p.state, p.city, p.district, p.street, p.housenumber].filter(v => typeof v === 'string' && v)
    return [{ ...value, name: String(p.name || p.street || '地图地点').slice(0, 60), address: [...new Set(parts)].join(' · ').slice(0, 200) }]
  })
}
