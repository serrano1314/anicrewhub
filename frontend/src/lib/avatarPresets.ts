import type { AvatarId } from '../types/auth'

export type AvatarPreset = {
  id: AvatarId
  name: string
}

const MAX_AVATAR_PRESETS = 50

function imageExists(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    const timeout = window.setTimeout(() => resolve(false), 3000)
    const finish = (exists: boolean) => {
      window.clearTimeout(timeout)
      resolve(exists)
    }
    image.onload = () => finish(true)
    image.onerror = () => finish(false)
    image.src = src
  })
}

export async function discoverAvatarPresets(): Promise<AvatarPreset[]> {
  const results = await Promise.all(
    Array.from({ length: MAX_AVATAR_PRESETS }, (_, index) => {
      const number = index + 1
      return imageExists(`/avatars/${number}.png`).then((exists) => ({ number, exists }))
    }),
  )

  return results
    .filter(({ exists }) => exists)
    .map(({ number }) => ({ id: String(number), name: `Avatar ${number}` }))
}
