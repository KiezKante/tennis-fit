import { useEffect, useMemo, useState } from 'react'
import { dateKey } from '../lib/plan'
import { supabase } from '../lib/supabase'

type WeightEntry = {
  checkin_date: string
  weight_kg: number | null
}

type ProgressCardProps = {
  userId: string
  completedTasks: number
  plannedTasks: number
  refreshToken: number
}

function localDateFromKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)

  return new Date(year, month - 1, day)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
  }).format(localDateFromKey(value))
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getWeightSummary(entries: WeightEntry[]) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(today.getDate() - 6)

  const previousWeekStart = new Date(today)
  previousWeekStart.setDate(today.getDate() - 13)

  const previousWeekEnd = new Date(today)
  previousWeekEnd.setDate(today.getDate() - 7)

  const validEntries = entries
    .filter((entry) => entry.weight_kg !== null)
    .map((entry) => ({
      ...entry,
      weight_kg: Number(entry.weight_kg),
      date: localDateFromKey(entry.checkin_date),
    }))

  const currentWeekWeights = validEntries
    .filter(
      (entry) =>
        entry.date >= currentWeekStart &&
        entry.date <= today,
    )
    .map((entry) => entry.weight_kg)

  const previousWeekWeights = validEntries
    .filter(
      (entry) =>
        entry.date >= previousWeekStart &&
        entry.date <= previousWeekEnd,
    )
    .map((entry) => entry.weight_kg)

  const sortedEntries = [...validEntries].sort((a, b) =>
    b.checkin_date.localeCompare(a.checkin_date),
  )

  const currentAverage = average(currentWeekWeights)
  const previousAverage = average(previousWeekWeights)

  return {
    latestWeight: sortedEntries[0]?.weight_kg ?? null,
    currentAverage,
    previousAverage,
    weeklyChange:
      currentAverage !== null && previousAverage !== null
        ? currentAverage - previousAverage
        : null,
  }
}

function WeightChart({ entries }: { entries: WeightEntry[] }) {
  const visibleEntries = [...entries]
    .filter((entry) => entry.weight_kg !== null)
    .map((entry) => ({
      ...entry,
      weight_kg: Number(entry.weight_kg),
    }))
    .sort((a, b) => a.checkin_date.localeCompare(b.checkin_date))
    .slice(-28)

  if (visibleEntries.length < 2) {
    return (
      <p className="chart-empty">
        Die Kurve erscheint, sobald mindestens zwei Gewichtseinträge vorhanden
        sind.
      </p>
    )
  }

  const values = visibleEntries.map((entry) => entry.weight_kg)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)

  const padding = Math.max(0.5, (rawMax - rawMin) * 0.2)
  const minWeight = rawMin - padding
  const maxWeight = rawMax + padding
  const weightRange = maxWeight - minWeight

  const width = 600
  const height = 190
  const sidePadding = 20
  const topPadding = 20
  const bottomPadding = 30

  const firstDate = localDateFromKey(visibleEntries[0].checkin_date)
  const lastDate = localDateFromKey(
    visibleEntries[visibleEntries.length - 1].checkin_date,
  )

  const timeRange = Math.max(
    1,
    lastDate.getTime() - firstDate.getTime(),
  )

  const points = visibleEntries.map((entry) => {
    const entryDate = localDateFromKey(entry.checkin_date)

    const x =
      sidePadding +
      ((entryDate.getTime() - firstDate.getTime()) / timeRange) *
        (width - sidePadding * 2)

    const y =
      topPadding +
      ((maxWeight - entry.weight_kg) / weightRange) *
        (height - topPadding - bottomPadding)

    return {
      ...entry,
      x,
      y,
    }
  })

  const linePoints = points
    .map((point) => `${point.x},${point.y}`)
    .join(' ')

  return (
    <div className="weight-chart">
      <div className="chart-scale">
        <span>{maxWeight.toFixed(1)} kg</span>
        <span>{minWeight.toFixed(1)} kg</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Gewichtsverlauf"
      >
        <line
          x1={sidePadding}
          y1={height - bottomPadding}
          x2={width - sidePadding}
          y2={height - bottomPadding}
          className="chart-axis"
        />

        <polyline
          points={linePoints}
          fill="none"
          className="chart-line"
        />

        {points.map((point) => (
          <circle
            key={point.checkin_date}
            cx={point.x}
            cy={point.y}
            r="5"
            className="chart-point"
          >
            <title>
              {formatDate(point.checkin_date)}: {point.weight_kg.toFixed(1)} kg
            </title>
          </circle>
        ))}
      </svg>

      <div className="chart-dates">
        <span>{formatDate(visibleEntries[0].checkin_date)}</span>
        <span>
          {formatDate(visibleEntries[visibleEntries.length - 1].checkin_date)}
        </span>
      </div>
    </div>
  )
}

export function ProgressCard({
  userId,
  completedTasks,
  plannedTasks,
  refreshToken,
}: ProgressCardProps) {
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadWeightHistory() {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 27)

      const { data, error } = await supabase
        .from('daily_checkins')
        .select('checkin_date, weight_kg')
        .gte('checkin_date', dateKey(startDate))
        .lte('checkin_date', dateKey(new Date()))
        .not('weight_kg', 'is', null)
        .order('checkin_date')

      if (!isActive) {
        return
      }

      if (error) {
        setError('Gewichtsverlauf konnte nicht geladen werden.')
        return
      }

      setWeightEntries(data ?? [])
    }

    void loadWeightHistory()

    return () => {
      isActive = false
    }
  }, [userId, refreshToken])

  const summary = useMemo(
    () => getWeightSummary(weightEntries),
    [weightEntries],
  )

  const trainingRate =
    plannedTasks === 0
      ? 0
      : Math.round((completedTasks / plannedTasks) * 100)

  const changeText =
    summary.weeklyChange === null
      ? 'Vergleich erscheint nach mindestens zwei Wochen.'
      : `${summary.weeklyChange > 0 ? '+' : ''}${summary.weeklyChange.toFixed(
          1,
        )} kg gegenüber der Vorwoche`

  return (
    <section className="section-card progress-card">
      <p className="eyebrow">FORTSCHRITT</p>
      <h2>Trend statt Tagesform.</h2>

      {error && <p className="error-message">{error}</p>}

      <div className="progress-grid">
        <article className="progress-metric">
          <span>Training diese Woche</span>
          <strong>
            {completedTasks} / {plannedTasks}
          </strong>
          <small>{trainingRate} % erledigt</small>
        </article>

        <article className="progress-metric">
          <span>Letztes Gewicht</span>
          <strong>
            {summary.latestWeight === null
              ? '–'
              : `${summary.latestWeight.toFixed(1)} kg`}
          </strong>
          <small>Einzelwert, nicht überbewerten</small>
        </article>

        <article className="progress-metric">
          <span>7-Tage-Schnitt</span>
          <strong>
            {summary.currentAverage === null
              ? '–'
              : `${summary.currentAverage.toFixed(1)} kg`}
          </strong>
          <small>Relevant für Entscheidungen</small>
        </article>

        <article className="progress-metric">
          <span>Vorwochen-Vergleich</span>
          <strong>
            {summary.weeklyChange === null
              ? '–'
              : `${summary.weeklyChange > 0 ? '+' : ''}${summary.weeklyChange.toFixed(
                  1,
                )} kg`}
          </strong>
          <small>{changeText}</small>
        </article>
      </div>

      <WeightChart entries={weightEntries} />
    </section>
  )
}
