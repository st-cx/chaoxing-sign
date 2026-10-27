export type ManualSignKind = 'normal' | 'photo' | 'location' | 'gesture' | 'code' | 'qr' | 'unknown'
export function manualSignKind(activity: { otherId?: number | string; ifPhoto?: number | string }): ManualSignKind {
  if (Number(activity.otherId) === 0)
    return Number(activity.ifPhoto) === 1 ? 'photo' : 'normal'
  return ({ 2: 'qr', 3: 'gesture', 4: 'location', 5: 'code' } as Record<number, ManualSignKind>)[Number(activity.otherId)] || 'unknown'
}
export const manualSignLabels: Record<ManualSignKind, string> = {
  normal: '普通签到', photo: '拍照签到', location: '位置签到', gesture: '手势签到', code: '签到码签到', qr: '扫码签到', unknown: '其他活动',
}
export const MAX_SIGN_PHOTO_BYTES = 5 * 1024 * 1024
export const SIGN_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export function validateSignPhotoFile(file: { size: number; type: string }) {
  if (!SIGN_PHOTO_TYPES.includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 照片')
  if (!file.size || file.size > MAX_SIGN_PHOTO_BYTES) throw new Error('照片大小须在 5 MB 以内，且不能为空')
}
