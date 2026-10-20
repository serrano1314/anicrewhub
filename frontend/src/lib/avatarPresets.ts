import type { AvatarId } from '../types/auth'

export type AvatarPreset = {
  id: AvatarId
  name: string
}

function imageExists(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = src
  })
}

export async function discoverAvatarPresets(): Promise<AvatarPreset[]> {
  const avatars: AvatarPreset[] = []
  for (let number = 1; await imageExists(`/avatars/${number}.png`); number += 1) {
    avatars.push({ id: String(number), name: `Avatar ${number}` })
  }
  return avatars
}
