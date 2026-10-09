// Keychain and Storage are provided by the Scripting runtime as globals.

export const BASE = "https://orbitaa.guillestyle2.workers.dev"
export const TOKEN_KEY = "jp7-todo-token-v1"
const ERROR_KEY = "jp7-todo-action-error-v1"
export type Today = { day: string; tasks: { id: string; title: string; priority: string }[]; pending: number }

export async function request(path: string, payload?: { id: string; day?: string; done?: boolean }, token = Keychain.get(TOKEN_KEY)): Promise<any> {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Abre JP7 ToDo en Scripting para conectar tu clave.")
  const response = await fetch(BASE + path, {
    method: payload === undefined ? "GET" : "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    timeout: 15,
    handleRedirect: async () => null,
  })
  let data: any
  try { data = await response.json() } catch { throw new Error("JP7 no ha respondido correctamente. Vuelve a intentarlo.") }
  if (!response.ok) {
    if (response.status === 401) Keychain.remove(TOKEN_KEY)
    throw new Error(data.error || "No se ha podido conectar con JP7.")
  }
  return data
}

export async function today(token?: string): Promise<Today> {
  const data = await request("/api/widget/today", undefined, token)
  if (!Array.isArray(data.tasks) || !Number.isInteger(data.pending) || typeof data.day !== "string") {
    throw new Error("La lista de JP7 no se ha podido cargar.")
  }
  return data
}

export function actionError(): string | null { return Storage.get<string>(ERROR_KEY) }
export function clearError() { Storage.remove(ERROR_KEY) }
export async function completeTask(id: string): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw new Error("Esta tarea no es válida.")
    await request("/api/widget/complete", { id })
    clearError()
    return true
  } catch (error) {
    Storage.set(ERROR_KEY, error instanceof Error ? error.message : "No se ha guardado. Vuelve a intentarlo.")
    return false
  }
}

export type HabitToday = { day: string; habits: { id: string; name: string; icon: string; done: boolean }[]; completed: number; total: number }
export async function habitsToday(): Promise<HabitToday> {
  const data = await request("/api/widget/habits")
  if (!Array.isArray(data.habits) || !Number.isInteger(data.completed) || !Number.isInteger(data.total) || typeof data.day !== "string") {
    throw new Error("Tus hábitos no se han podido cargar.")
  }
  return data
}
export async function setHabit(id: string, day: string, done: boolean): Promise<boolean> {
  try {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || typeof done !== "boolean") throw new Error("Este hábito no es válido.")
    await request("/api/widget/habit", { id, day, done })
    clearError()
    return true
  } catch (error) {
    Storage.set(ERROR_KEY, error instanceof Error ? error.message : "No se ha guardado el hábito.")
    return false
  }
}
