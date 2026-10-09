import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { completeTask, clearError, setHabit } from "./model"

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

export const SetHabit = AppIntentManager.register({
  name: "JP7SetHabit",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (params: { id: string; day: string; done: boolean }) => {
    await setHabit(params.id, params.day, params.done)
    Widget.reloadAll()
  },
})
