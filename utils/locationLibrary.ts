import { isQrCoordinates, type QrCoordinates } from './qrLocation'

export interface SavedLocation extends QrCoordinates {
  id: string
  name: string
  address: string
  coordinateSystem: 'wgs84' | 'bd09'
}

export const LOCATION_LIMIT = 200

export function parseCoordinatePair(text: string) {
  const parts = text.trim().split(/[,，\s]+/)
  if (parts.length !== 2 || parts.some(part => !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(part)))
    throw new Error('请粘贴“经度,纬度”，例如 113.093000,22.600000')
  const longitude = Number(parts[0])
  const latitude = Number(parts[1])
  if (!isQrCoordinates({ longitude, latitude }))
    throw new Error('坐标超出范围，请确认顺序为经度、纬度')
  return { longitude: String(longitude), latitude: String(latitude) }
}

export function validateLocation(value: unknown): Omit<SavedLocation, 'id'> {
  if (!value || typeof value !== 'object')
    throw new Error('坐标数据格式不正确')
  const item = value as Record<string, unknown>
  if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 60)
    throw new Error('请输入 1–60 字的位置名称')
  if (typeof item.address !== 'string' || item.address.length > 200)
    throw new Error('地址最多 200 字')
  if (item.coordinateSystem !== 'wgs84' && item.coordinateSystem !== 'bd09')
    throw new Error('请选择坐标来源')
  if ([item.longitude, item.latitude].some(v => v === '' || v == null || (typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === ''))
    throw new Error('经度和纬度都不能为空')
  const coordinates = { longitude: Number(item.longitude), latitude: Number(item.latitude) }
  if (!isQrCoordinates(coordinates) || (coordinates.longitude === -1 && coordinates.latitude === -1))
    throw new Error('经度须在 -180～180，纬度须在 -90～90；不能保存未设置的坐标')
  return { ...coordinates, name: item.name.trim(), address: item.address.trim(), coordinateSystem: item.coordinateSystem }
}

export function parseLocationImport(text: string): Omit<SavedLocation, 'id'>[] {
  if (text.length > 512_000)
    throw new Error('文件过大，请使用 500 KB 以内的坐标库文件')
  let document: unknown
  try { document = JSON.parse(text) }
  catch { throw new Error('文件不是有效的 JSON 坐标库') }
  const data = document as { version?: number; locations?: unknown[] }
  if (data?.version !== 1 || !Array.isArray(data.locations) || data.locations.length > LOCATION_LIMIT)
    throw new Error(`请导入版本 1 的坐标库文件，每次最多 ${LOCATION_LIMIT} 条`)
  return data.locations.map(validateLocation)
}

export function locationFingerprint(item: Omit<SavedLocation, 'id'>) {
  return JSON.stringify([item.name, item.address, item.longitude, item.latitude, item.coordinateSystem])
}
