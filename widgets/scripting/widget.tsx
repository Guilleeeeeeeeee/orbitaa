import { Button, HStack, VStack, Text, Image, Spacer, Link, Widget } from "scripting"
import { CompleteTask, RefreshTasks } from "./app_intents"
import { BASE, today, actionError, type Today } from "./model"

const PINK = "#ff4d9d"
const MUTED = "#96939f"

function ToDo({ data, error }: { data: Today | null; error: string | null }) {
  const rows = data?.tasks.slice(0, 3) || []
  return <HStack spacing={18} alignment="top" widgetBackground="#17151c">
    <VStack alignment="leading" spacing={5} frame={{ width: 82 }}>
      <Image systemName="sun.max.fill" font={23} foregroundStyle={PINK} />
      <Text font={25} fontWeight="bold" foregroundStyle="white">Hoy</Text>
      <Text font={12} foregroundStyle={MUTED}>
        {data ? `${data.pending} pendiente${data.pending === 1 ? "" : "s"}` : "Sin conexión"}
      </Text>
      <Spacer />
      <HStack spacing={13}>
        <Link url={BASE + "/#tasks"}>
          <Image systemName="plus.circle.fill" font={24} foregroundStyle={PINK} />
        </Link>
        <Button intent={RefreshTasks(undefined)} buttonStyle="plain">
          <Image systemName="arrow.clockwise" font={15} foregroundStyle={MUTED} />
        </Button>
      </HStack>
    </VStack>
    <VStack alignment="leading" spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topLeading" }}>
      {rows.map(task => <Button key={task.id} intent={CompleteTask({ id: task.id })} buttonStyle="plain">
        <HStack spacing={9} frame={{ maxWidth: "infinity", minHeight: 30, alignment: "leading" }}>
          <Image systemName="circle" font={21} foregroundStyle={PINK} />
          <Text font={14} fontWeight="medium" foregroundStyle="white" lineLimit={1}>{task.title}</Text>
          <Spacer />
        </HStack>
      </Button>)}
      {data && rows.length === 0 ? <VStack alignment="leading" spacing={6}>
        <Image systemName="checkmark.circle" font={26} foregroundStyle={PINK} />
        <Text font={15} fontWeight="semibold" foregroundStyle="white">Todo hecho por hoy</Text>
        <Text font={11} foregroundStyle={MUTED}>Añade tareas con fecha de hoy en JP7.</Text>
      </VStack> : null}
      {data && data.pending > 3 ? <Text font={10} foregroundStyle={MUTED}>+{data.pending - 3} más en JP7</Text> : null}
      {error ? <Text font={10} foregroundStyle={PINK} lineLimit={3}>{error}</Text> : null}
      <Spacer />
    </VStack>
  </HStack>
}

let data: Today | null = null
let error: string | null = actionError()
try { data = await today() } catch (failure) {
  error = failure instanceof Error ? failure.message : "No se ha podido cargar JP7. Pulsa la flecha para reintentar."
}
Widget.present(<ToDo data={data} error={error} />, { policy: "after", date: new Date(Date.now() + 5 * 60 * 1000) })
