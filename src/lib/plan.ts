export type PlannedTaskSeed = {
  user_id: string
  scheduled_date: string
  task_key: string
  task_type: string
  title: string
  description: string
  planned_minutes: number
}

type WeeklyPlanItem = Omit<
  PlannedTaskSeed,
  'user_id' | 'scheduled_date'
> & {
  weekday: number
}

// 1 = Montag, 2 = Dienstag, ... 7 = Sonntag
const weeklyPlan: WeeklyPlanItem[] = [
  {
    weekday: 1,
    task_key: 'strength_a',
    task_type: 'strength_a',
    title: 'Kraft A',
    description:
      '25 Minuten. Kniebeugen zum Stuhl, erhöhte Liegestütze, Glute Bridge, Wadenheben und Dead Bug.',
    planned_minutes: 25,
  },
  {
    weekday: 2,
    task_key: 'tennis',
    task_type: 'tennis',
    title: 'Tennis',
    description:
      'Deine Haupteinheit. Kein zusätzliches hartes Cardio nötig.',
    planned_minutes: 90,
  },
  {
    weekday: 3,
    task_key: 'cycling',
    task_type: 'cycling',
    title: 'Fahrrad locker',
    description:
      '30 Minuten im Gesprächstempo. Du solltest noch ganze Sätze sprechen können.',
    planned_minutes: 30,
  },
  {
    weekday: 4,
    task_key: 'tennis',
    task_type: 'tennis',
    title: 'Tennis',
    description:
      'Deine Haupteinheit. Kniegefühl danach kurz einschätzen.',
    planned_minutes: 90,
  },
  {
    weekday: 6,
    task_key: 'strength_b',
    task_type: 'strength_b',
    title: 'Kraft B',
    description:
      '25 Minuten. Good Mornings, unterstützte Rückwärts-Ausfallschritte, erhöhte Liegestütze, Bird Dog und Seitstütz.',
    planned_minutes: 25,
  },
  {
    weekday: 7,
    task_key: 'cycling_long',
    task_type: 'cycling',
    title: 'Fahrrad locker',
    description:
      '40 Minuten im Gesprächstempo. Kein Leistungsziel, nur Grundausdauer.',
    planned_minutes: 40,
  },
]

export function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function mondayOf(date: Date) {
  const copy = new Date(date)
  const weekday = copy.getDay()
  const daysSinceMonday = (weekday + 6) % 7

  copy.setDate(copy.getDate() - daysSinceMonday)
  copy.setHours(0, 0, 0, 0)

  return copy
}

export function weekRange(date = new Date()) {
  const monday = mondayOf(date)
  const sunday = new Date(monday)

  sunday.setDate(monday.getDate() + 6)

  return {
    start: dateKey(monday),
    end: dateKey(sunday),
  }
}

export function createWeekTasks(
  userId: string,
  date = new Date(),
): PlannedTaskSeed[] {
  const monday = mondayOf(date)

  return weeklyPlan.map((item) => {
    const scheduledDate = new Date(monday)
    scheduledDate.setDate(monday.getDate() + item.weekday - 1)

    return {
      user_id: userId,
      scheduled_date: dateKey(scheduledDate),
      task_key: item.task_key,
      task_type: item.task_type,
      title: item.title,
      description: item.description,
      planned_minutes: item.planned_minutes,
    }
  })
}
