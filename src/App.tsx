import { useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

export default function App() {
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