import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { completeTask, clearError } from "./model"

export const CompleteTask = AppIntentManager.register({
  name: "JP7CompleteTask",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (params: { id: string }) => {
    await completeTask(params.id)
    Widget.reloadAll()
  },
})

export const RefreshTasks = AppIntentManager.register({
  name: "JP7RefreshTasks",
  protocol: AppIntentProtocol.AppIntent,
  perform: async () => {
    clearError()
    Widget.reloadAll()
  },
})
