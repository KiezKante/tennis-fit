import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { ProgressCard } from './components/ProgressCard'
import { createWeekTasks, dateKey, weekRange } from './lib/plan'
import { supabase } from './lib/supabase'
import './App.css'

type Profile = {
  calorie_target: number
  protein_target_g: number
}

type Task = {
  id: string
  scheduled_date: string
  title: string
  description: string | null
  planned_minutes: number | null
  status: 'planned' | 'completed' | 'skipped' | 'adjusted'
}

type Meal = {
  id: string
  description: string
  calories: number
  protein_g: number
  is_free_meal: boolean
}

type CheckinForm = {
  weight: string
  sleep: string
  energy: string
  knee: string
  notes: string
}

const emptyCheckin: CheckinForm = {
  weight: '',
  sleep: '',
  energy: '',
  knee: '',
  notes: '',
}

function numberOrNull(value: string) {
  return value === '' ? null : Number(value)
}

function getCoachTip(checkin: CheckinForm) {
  const knee = Number(checkin.knee || 0)
  const sleep = Number(checkin.sleep || 0)
  const energy = Number(checkin.energy || 0)

  if (knee >= 4) {
    return 'Knie heute nicht wegdiskutieren. Belastung reduzieren und keine harte Einheit erzwingen.'
  }

  if (sleep > 0 && sleep < 6) {
    return 'Schlechter Schlaf ist kein Charaktertest. Heute sauber und leichter trainieren.'
  }

  if (energy > 0 && energy <= 2) {
    return 'Niedrige Energie: Aufgabe kleiner machen, aber nicht automatisch aufgeben.'
  }

  return 'Heute zählt Umsetzung. Nicht perfekt, aber erledigt.'
}

function Login() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setMessage('')
    setError('')
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })

    setIsLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setMessage(
      'Magic Link wurde versendet. Prüfe dein E-Mail-Postfach und öffne den Link.',
    )
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">TENNIS FIT</p>

        <h1>
          Trainieren.
          <br />
          Tracken.
          <br />
          Dranbleiben.
        </h1>

        <p className="intro">
          Dein persönlicher Assistent für Tennis, Kondition und Fettabbau.
        </p>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Deine E-Mail-Adresse</label>

          <input
            id="email"
            type="email"
            placeholder="du@beispiel.de"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Link wird versendet …' : 'Magic Link senden'}
          </button>
        </form>

        {message && <p className="success-message">{message}</p>}
        {error && <p className="error-message">{error}</p>}

        <p className="small-print">
          Kein Passwort. Du erhältst einen einmalig nutzbaren Link per E-Mail.
        </p>
      </section>
    </main>
  )
}

function Dashboard({ userId }: { userId: string }) {
  const today = dateKey(new Date())
  const { start, end } = weekRange()

  const [profile, setProfile] = useState<Profile>({
    calorie_target: 2300,
    protein_target_g: 140,
  })

  const [tasks, setTasks] = useState<Task[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [checkin, setCheckin] = useState<CheckinForm>(emptyCheckin)

  const [mealDescription, setMealDescription] = useState('')
  const [mealCalories, setMealCalories] = useState('')
  const [mealProtein, setMealProtein] = useState('')
  const [freeMeal, setFreeMeal] = useState(false)

  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [weightRefreshToken, setWeightRefreshToken] = useState(0)

  async function loadDashboard() {
    setIsLoading(true)
    setError('')

    try {
      // Legt die Aufgaben der aktuellen Woche an,
      // ohne bereits vorhandene Aufgaben zu überschreiben.
      const weekTasks = createWeekTasks(userId)

      const { error: seedError } = await supabase
        .from('planned_tasks')
        .upsert(weekTasks, {
          onConflict: 'user_id,scheduled_date,task_key',
          ignoreDuplicates: true,
        })

      if (seedError) {
        throw seedError
      }

      const [profileResult, tasksResult, checkinResult, mealsResult] =
        await Promise.all([
          supabase
            .from('profiles')
            .select('calorie_target, protein_target_g')
            .eq('id', userId)
            .maybeSingle(),

          supabase
            .from('planned_tasks')
            .select(
              'id, scheduled_date, title, description, planned_minutes, status',
            )
            .gte('scheduled_date', start)
            .lte('scheduled_date', end)
            .order('scheduled_date'),

          supabase
            .from('daily_checkins')
            .select('weight_kg, sleep_hours, energy, knee_pain, notes')
            .eq('checkin_date', today)
            .maybeSingle(),

          supabase
            .from('meal_entries')
            .select('id, description, calories, protein_g, is_free_meal')
            .eq('eaten_on', today)
            .order('created_at'),
        ])

      if (profileResult.error) throw profileResult.error
      if (tasksResult.error) throw tasksResult.error
      if (checkinResult.error) throw checkinResult.error
      if (mealsResult.error) throw mealsResult.error

      if (profileResult.data) {
        setProfile(profileResult.data)
      }

      setTasks(tasksResult.data ?? [])
      setMeals(mealsResult.data ?? [])

      if (checkinResult.data) {
        setCheckin({
          weight: checkinResult.data.weight_kg?.toString() ?? '',
          sleep: checkinResult.data.sleep_hours?.toString() ?? '',
          energy: checkinResult.data.energy?.toString() ?? '',
          knee: checkinResult.data.knee_pain?.toString() ?? '',
          notes: checkinResult.data.notes ?? '',
        })
      }
    } catch (error) {
      console.error(error)
      setError(
        'Daten konnten nicht geladen werden. Prüfe später den genauen Fehler in der Browser-Konsole.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [userId])

  const todayTasks = tasks.filter((task) => task.scheduled_date === today)
  const completedTasks = tasks.filter(
    (task) => task.status === 'completed',
  ).length

  const totalCalories = meals.reduce(
    (sum, meal) => sum + Number(meal.calories),
    0,
  )

  const totalProtein = meals.reduce(
    (sum, meal) => sum + Number(meal.protein_g),
    0,
  )

  const coachTip = useMemo(() => getCoachTip(checkin), [checkin])

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'completed' ? 'planned' : 'completed'

    const { error } = await supabase
      .from('planned_tasks')
      .update({ status: newStatus })
      .eq('id', task.id)

    if (error) {
      setError(error.message)
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === task.id
          ? { ...currentTask, status: newStatus }
          : currentTask,
      ),
    )
  }

  async function saveCheckin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    const { error } = await supabase.from('daily_checkins').upsert(
      {
        user_id: userId,
        checkin_date: today,
        weight_kg: numberOrNull(checkin.weight),
        sleep_hours: numberOrNull(checkin.sleep),
        energy: numberOrNull(checkin.energy),
        knee_pain: numberOrNull(checkin.knee),
        notes: checkin.notes || null,
      },
      {
        onConflict: 'user_id,checkin_date',
      },
    )

    if (error) {
      setError(error.message)
      return
    }

    setNotice('Check-in gespeichert.')
    setWeightRefreshToken((currentToken) => currentToken + 1) 
  }

  async function addMeal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!mealDescription || !mealCalories) {
      setError('Bitte mindestens Mahlzeit und Kalorien eintragen.')
      return
    }

    const { error } = await supabase.from('meal_entries').insert({
      user_id: userId,
      eaten_on: today,
      description: mealDescription,
      calories: Number(mealCalories),
      protein_g: Number(mealProtein || 0),
      source: 'manual',
      is_free_meal: freeMeal,
    })

    if (error) {
      setError(error.message)
      return
    }

    setMealDescription('')
    setMealCalories('')
    setMealProtein('')
    setFreeMeal(false)

    await loadDashboard()
  }

  async function deleteMeal(mealId: string) {
    const { error } = await supabase
      .from('meal_entries')
      .delete()
      .eq('id', mealId)

    if (error) {
      setError(error.message)
      return
    }

    setMeals((currentMeals) =>
      currentMeals.filter((meal) => meal.id !== mealId),
    )
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">TENNIS FIT</p>
          <h1>Heute zählt.</h1>
        </div>

        <button
          className="secondary-button"
          type="button"
          onClick={() => supabase.auth.signOut()}
        >
          Abmelden
        </button>
      </header>

      {isLoading && <p className="status-message">Daten werden geladen …</p>}
      {error && <p className="error-message">{error}</p>}
      {notice && <p className="success-message">{notice}</p>}

      <section className="coach-card">
        <p className="eyebrow">HEUTIGER HINWEIS</p>
        <p>{coachTip}</p>
      </section>

      <section className="stat-grid">
        <article className="stat-card">
          <p className="eyebrow">TRAINING DIESE WOCHE</p>
          <p className="stat-number">
            {completedTasks} <span>/ {tasks.length}</span>
          </p>
          <p className="muted">Einheiten erledigt</p>
        </article>

        <article className="stat-card">
          <p className="eyebrow">ERNÄHRUNG HEUTE</p>
          <p className="stat-number">
            {totalCalories} <span>/ {profile.calorie_target}</span>
          </p>
          <p className="muted">
            {Math.round(totalProtein)} g / {profile.protein_target_g} g Protein
          </p>
        </article>
      </section>
<ProgressCard
  userId={userId}
  completedTasks={completedTasks}
  plannedTasks={tasks.length}
  refreshToken={weightRefreshToken}
/>

      <section className="section-card">
        <p className="eyebrow">HEUTE</p>
        <h2>Deine Aufgabe</h2>

        {todayTasks.length === 0 ? (
          <p>
            Ruhetag. Gassi-Runden sind genug. Du musst keine verpasste Einheit
            nachholen.
          </p>
        ) : (
          <div className="task-list">
            {todayTasks.map((task) => (
              <label className="task-row" key={task.id}>
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => void toggleTask(task)}
                />

                <span>
                  <strong>{task.title}</strong>
                  <small>
                    {task.planned_minutes ?? 0} Minuten · {task.description}
                  </small>
                </span>
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="section-card">
        <p className="eyebrow">MORGEN-CHECK-IN</p>
        <h2>Wie ist deine Tagesform?</h2>

        <form className="form-grid" onSubmit={saveCheckin}>
          <label>
            Gewicht in kg
            <input
              type="number"
              step="0.1"
              value={checkin.weight}
              onChange={(event) =>
                setCheckin({ ...checkin, weight: event.target.value })
              }
              placeholder="115.0"
            />
          </label>

          <label>
            Schlaf in Stunden
            <input
              type="number"
              min="0"
              max="24"
              step="0.5"
              value={checkin.sleep}
              onChange={(event) =>
                setCheckin({ ...checkin, sleep: event.target.value })
              }
              placeholder="7.5"
            />
          </label>

          <label>
            Energie: 1–5
            <input
              type="number"
              min="1"
              max="5"
              value={checkin.energy}
              onChange={(event) =>
                setCheckin({ ...checkin, energy: event.target.value })
              }
            />
          </label>

          <label>
            Knie: 0–10
            <input
              type="number"
              min="0"
              max="10"
              value={checkin.knee}
              onChange={(event) =>
                setCheckin({ ...checkin, knee: event.target.value })
              }
            />
          </label>

          <label className="full-width">
            Kurze Notiz, optional
            <textarea
              value={checkin.notes}
              onChange={(event) =>
                setCheckin({ ...checkin, notes: event.target.value })
              }
              placeholder="Zum Beispiel: Beine schwer nach Tennis."
            />
          </label>

          <button type="submit">Check-in speichern</button>
        </form>
      </section>

      <section className="section-card">
        <p className="eyebrow">MAHLZEIT HINZUFÜGEN</p>
        <h2>Kalorien und Protein</h2>

        <form className="form-grid" onSubmit={addMeal}>
          <label className="full-width">
            Was hast du gegessen?
            <input
              value={mealDescription}
              onChange={(event) => setMealDescription(event.target.value)}
              placeholder="Zum Beispiel: Skyr mit Banane und Haferflocken"
            />
          </label>

          <label>
            Kalorien
            <input
              type="number"
              min="0"
              value={mealCalories}
              onChange={(event) => setMealCalories(event.target.value)}
              placeholder="450"
            />
          </label>

          <label>
            Protein in Gramm
            <input
              type="number"
              min="0"
              step="0.1"
              value={mealProtein}
              onChange={(event) => setMealProtein(event.target.value)}
              placeholder="35"
            />
          </label>

          <label className="checkbox-label full-width">
            <input
              type="checkbox"
              checked={freeMeal}
              onChange={(event) => setFreeMeal(event.target.checked)}
            />
            Als freie Mahlzeit markieren
          </label>

          <button type="submit">Mahlzeit speichern</button>
        </form>

        {meals.length > 0 && (
          <div className="meal-list">
            {meals.map((meal) => (
              <article className="meal-row" key={meal.id}>
                <div>
                  <strong>{meal.description}</strong>
                  <small>
                    {meal.calories} kcal · {meal.protein_g} g Protein
                    {meal.is_free_meal ? ' · freie Mahlzeit' : ''}
                  </small>
                </div>

                <button
                  className="delete-button"
                  type="button"
                  onClick={() => void deleteMeal(meal.id)}
                >
                  Löschen
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    async function loadSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      setSession(session)
      setIsCheckingSession(false)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsCheckingSession(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isCheckingSession) {
    return <main className="loading-page">Lade Tennis Fit …</main>
  }

  if (!session) {
    return <Login />
  }

  return <Dashboard userId={session.user.id} />
}
