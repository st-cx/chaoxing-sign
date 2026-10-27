import { ref } from 'vue'
import { isQrCoordinates, type QrCoordinates } from './qrLocation'

export const clientLocationStatus = ref<'loading' | 'ready' | 'unavailable'>('loading')
export const runtimeLocation = ref<(QrCoordinates & { name: string }) | null>(null)

export function setRuntimeLocation(value: (QrCoordinates & { name: string }) | null) {
  runtimeLocation.value = value ? { ...value } : null
}

function savedCoordinates(): QrCoordinates | null {
  const value = runtimeLocation.value
  return value ? { latitude: value.latitude, longitude: value.longitude, coordinateSystem: value.coordinateSystem } : null
}

let location: QrCoordinates | null = null
let pending: Promise<QrCoordinates | null> | null = null
let generation = 0
let qrModalLocationRequest: Promise<QrCoordinates | null> | null = null

export function refreshClientLocation(): Promise<QrCoordinates | null> {
  const requestGeneration = ++generation
  location = null
  clientLocationStatus.value = 'loading'

  const request = new Promise<QrCoordinates | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      clientLocationStatus.value = 'unavailable'
      resolve(null)
      return
    }

    let settled = false
    const finish = (coordinates: QrCoordinates | null) => {
      if (settled)
        return
      settled = true
      clearTimeout(deadline)
      if (requestGeneration === generation) {
        location = coordinates
        clientLocationStatus.value = coordinates ? 'ready' : 'unavailable'
      }
      resolve(coordinates)
    }
    const deadline = setTimeout(() => finish(null), 10_500)
    try {
      navigator.geolocation.getCurrentPosition(
        position => finish(isQrCoordinates(position.coords)
          ? { latitude: position.coords.latitude, longitude: position.coords.longitude }
          : null),
        () => finish(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
      )
    }
    catch {
      finish(null)
    }
  })
  pending = request
  return request
}

export async function getClientLocationForQr(): Promise<QrCoordinates | null> {
  const saved = savedCoordinates()
  if (saved)
    return saved
  while (pending) {
    const request = pending
    await request
    if (pending === request)
      break
  }
  return location ? { ...location } : null
}

export async function getFreshClientLocationForSign(): Promise<QrCoordinates | null> {
  return savedCoordinates() || refreshClientLocation()
}

export function requestQrModalLocationOnce(): Promise<QrCoordinates | null> {
  const saved = savedCoordinates()
  if (saved)
    return Promise.resolve(saved)
  qrModalLocationRequest ??= refreshClientLocation()
  return qrModalLocationRequest
}
