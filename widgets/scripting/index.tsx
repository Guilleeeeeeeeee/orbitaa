import { Script, Widget } from "scripting"
import { TOKEN_KEY, today, clearError } from "./model"

async function main() {
  try {
    if (!Keychain.get(TOKEN_KEY)) {
      const value = await Dialog.prompt({
        title: "Conectar JP7 ToDo",
        message: "Pega la clave del widget de JP7 → Ajustes → Conectar Scripting. Es la clave del widget, no la contraseña de la app.",
        obscureText: true,
        placeholder: "Clave privada del widget",
        confirmLabel: "Conectar",
        cancelLabel: "Cancelar",
      })
      if (value === null) return
      const token = value.trim()
      await today(token)
      if (!Keychain.set(TOKEN_KEY, token)) throw new Error("No se ha podido guardar la clave en el iPhone.")
    } else {
      await today()
    }
    clearError()
    Widget.reloadAll()
    await Widget.preview({ family: "systemMedium" })
  } catch (error) {
    await Dialog.alert({ title: "JP7 ToDo", message: error instanceof Error ? error.message : "No se ha podido conectar. Comprueba la conexión." })
  }
}
main().finally(() => Script.exit())
