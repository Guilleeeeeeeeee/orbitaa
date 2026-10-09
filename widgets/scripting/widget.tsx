import { AccessoryWidgetBackground, Button, HStack, VStack, ZStack, Text, Image, Spacer, Link, Widget } from "scripting"
import { CompleteTask, RefreshTasks, SetHabit } from "./app_intents"
import { BASE, today, habitsToday, actionError, type Today, type HabitToday } from "./model"

const PINK = "#ff4d9d"
const MUTED = "#96939f"
const BG = "#17151c"

function Header({ title, symbol, caption, section }: { title: string; symbol: string; caption: string; section: string }) {
  return <HStack spacing={7}>
    <Image systemName={symbol} font={15} foregroundStyle={PINK} />
    <Text font={18} fontWeight="bold" foregroundStyle="white">{title}</Text>
    <Text font={11} foregroundStyle={MUTED} lineLimit={1}>{caption}</Text>
    <Spacer />
    <Button intent={RefreshTasks(undefined)} buttonStyle="plain">
      <Image systemName="arrow.clockwise" font={13} foregroundStyle={MUTED} frame={{ width: 24, height: 24 }} />
    </Button>
    <Link url={BASE + "/#" + section}>
      <Image systemName="plus.circle.fill" font={22} foregroundStyle={PINK} />
    </Link>
  </HStack>
}

function Empty({ title, subtitle, symbol }: { title: string; subtitle: string; symbol: string }) {
  return <VStack spacing={5} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
    <Image systemName={symbol} font={25} foregroundStyle={PINK} />
    <Text font={15} fontWeight="semibold" foregroundStyle="white" lineLimit={1}>{title}</Text>
    <Text font={11} foregroundStyle={MUTED} lineLimit={2} multilineTextAlignment="center">{subtitle}</Text>
  </VStack>
}

function ToDo({ data, error }: { data: Today | null; error: string | null }) {
  const limit = Widget.family === "systemLarge" ? 8 : error ? 2 : 3
  const rows = data?.tasks.slice(0, limit) || []
  return <VStack alignment="leading" spacing={8} padding={16} widgetBackground={BG} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <Header title="Hoy" symbol="sun.max.fill" caption={data ? `${data.pending} pendiente${data.pending === 1 ? "" : "s"}` : "Sin conexión"} section="tasks" />
    {rows.length ? <VStack alignment="leading" spacing={5} frame={{ maxWidth: "infinity" }}>
      {rows.map(task => <Button key={task.id} intent={CompleteTask({ id: task.id })} buttonStyle="plain">
        <HStack spacing={9} frame={{ maxWidth: "infinity", height: 25, alignment: "leading" }}>
          <Image systemName="circle" font={20} foregroundStyle={PINK} />
          <Text font={13} fontWeight="medium" foregroundStyle="white" lineLimit={1}>{task.title}</Text>
          <Spacer />
          {task.priority === "high" ? <Image systemName="exclamationmark" font={11} foregroundStyle={PINK} /> : null}
        </HStack>
      </Button>)}
    </VStack> : <Empty title={data ? "Todo al día" : "Conecta tu widget"} subtitle={data ? "Un poquito de paz. Te lo has ganado." : "Abre JP7 ToDo en Scripting."} symbol={data ? "checkmark.circle" : "wifi.exclamationmark"} />}
    {error ? <Text font={10} foregroundStyle={PINK} lineLimit={2}>{error}</Text> : null}
  </VStack>
}

const icons: Record<string, string> = {
  "dumbbell": "dumbbell.fill", "briefcase-business": "briefcase.fill", "activity": "figure.run",
  "book-open": "book.fill", "droplets": "drop.fill", "moon": "moon.fill", "footprints": "figure.walk", "target": "scope",
}
function Habits({ data, error }: { data: HabitToday | null; error: string | null }) {
  const limit = Widget.family === "systemLarge" ? 8 : error ? 2 : 3
  const rows = data?.habits.slice(0, limit) || []
  return <VStack alignment="leading" spacing={8} padding={16} widgetBackground={BG} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
    <Header title="Hábitos" symbol="sparkles" caption={data ? `${data.completed}/${data.total} hoy` : "Sin conexión"} section="habits" />
    {rows.length ? <VStack alignment="leading" spacing={6} frame={{ maxWidth: "infinity" }}>
      {rows.map(habit => <Button key={habit.id} intent={SetHabit({ id: habit.id, day: data!.day, done: !habit.done })} buttonStyle="plain">
        <HStack spacing={10} frame={{ maxWidth: "infinity", height: 26, alignment: "leading" }}>
          <Image systemName={icons[habit.icon] || "sparkles"} font={16} foregroundStyle={habit.done ? MUTED : PINK} frame={{ width: 22 }} />
          <Text font={13} fontWeight="medium" foregroundStyle={habit.done ? MUTED : "white"} lineLimit={1}>{habit.name}</Text>
          <Spacer />
          <Image systemName={habit.done ? "checkmark.circle.fill" : "circle"} font={22} foregroundStyle={PINK} />
        </HStack>
      </Button>)}
    </VStack> : <Empty title={data ? "Tu rutina empieza aquí" : "Conecta tu widget"} subtitle={data ? "Añade tu primer hábito con +." : "Abre JP7 ToDo en Scripting."} symbol="sparkles" />}
    {error ? <Text font={10} foregroundStyle={PINK} lineLimit={2}>{error}</Text> : null}
  </VStack>
}

function LockCounter({ data }: { data: Today | null }) {
  const count = data ? String(data.pending) : "—"
  if (Widget.family === "accessoryRectangular") return <HStack spacing={8}>
    <Image systemName="sun.max" font={22} />
    <VStack alignment="leading" spacing={1}>
      <Text font={20} fontWeight="bold">{count} pendientes</Text>
      <Text font={11}>{data ? "ToDo · Hoy" : "Abre Scripting para conectar"}</Text>
    </VStack>
  </HStack>
  if (Widget.family === "accessoryInline") return <Text>{data ? `☀ ${count} tareas pendientes` : "JP7 · Sin conexión"}</Text>
  return <ZStack>
    <AccessoryWidgetBackground />
    <VStack spacing={1}>
      <Image systemName="sun.max" font={12} />
      <Text font={25} fontWeight="bold" lineLimit={1} minimumScaleFactor={0.5}>{count}</Text>
    </VStack>
  </ZStack>
}

function habitsMode() {
  const parameter = (Widget.parameter || "").trim().toLowerCase()
  if (["habitos", "hábitos", "habits"].includes(parameter)) return true
  try { return JSON.parse(parameter)?.view === "habits" } catch { return false }
}
async function renderWidget() {
  const lock = String(Widget.family).startsWith("accessory")
  const habits = !lock && habitsMode()
  let data: Today | null = null
  let habitData: HabitToday | null = null
  let error: string | null = actionError()
  try {
    if (habits) habitData = await habitsToday()
    else data = await today()
  } catch (failure) {
    error = failure instanceof Error ? failure.message : "No se ha podido cargar JP7."
  }
  const element = lock ? <LockCounter data={data} /> : habits ? <Habits data={habitData} error={error} /> : <ToDo data={data} error={error} />
  Widget.present(element, { policy: "after", date: new Date(Date.now() + 5 * 60 * 1000) })
}

renderWidget()
