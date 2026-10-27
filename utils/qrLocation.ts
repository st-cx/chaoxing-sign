export interface QrCoordinates {
  latitude: number
  longitude: number
  coordinateSystem?: 'wgs84' | 'bd09'
}

export function isQrCoordinates(value: unknown): value is QrCoordinates {
  if (!value || typeof value !== 'object')
    return false

  const coordinates = value as Record<string, unknown>
  return (coordinates.coordinateSystem === undefined || coordinates.coordinateSystem === 'wgs84' || coordinates.coordinateSystem === 'bd09')
    && typeof coordinates.latitude === 'number'
    && Number.isFinite(coordinates.latitude)
    && coordinates.latitude >= -90
    && coordinates.latitude <= 90
    && typeof coordinates.longitude === 'number'
    && Number.isFinite(coordinates.longitude)
    && coordinates.longitude >= -180
    && coordinates.longitude <= 180
}
