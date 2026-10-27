import { authFetch, readError } from './http'

export const blocksApi = {
  // Заблокирован ли?
  isBlocked: async (userId: string): Promise<boolean> => {
    const r = await authFetch(`/api/userblock/${userId}`)
    if (!r.ok) return false
    return (await r.json()).blocked === true
  },
  // Заблокировать
  block: async (userId: string) => {
    const r = await authFetch(`/api/userblock/${userId}`, { method: 'POST' })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось заблокировать'))
  },
  // Разблокировать
  unblock: async (userId: string) => {
    const r = await authFetch(`/api/userblock/${userId}`, { method: 'DELETE' })
    if (!r.ok) throw new Error(await readError(r, 'Не удалось разблокировать'))
  },
}