import { useEffect, useState, type FormEvent } from "react"
import { Alert } from "../components/ui/Alert"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { Input } from "../components/ui/Field"
import { Spinner } from "../components/ui/Spinner"
import { adminToken, clearAdmin, currentSession, loginAdmin, type Person } from "../lib/authApi"
import styles from "./Access.module.css"

const MANAGERS = [
  { slug: "fran", name: "Fran" },
  { slug: "curro", name: "Curro" },
]

export function AdminAccess() {
  const [ready, setReady] = useState(!adminToken())
  const [person, setPerson] = useState<Person | null>(null)
  const [slug, setSlug] = useState("fran")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!adminToken()) return
    let active = true
    currentSession("admin").then((result) => {
      if (!active) return
      if (!result.ok) {
        if (!result.message.includes("conexión")) clearAdmin()
        if (result.message) setError(result.message)
      } else {
        setPerson(result.person)
      }
      setReady(true)
    })
    return () => {
      active = false
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await loginAdmin(slug, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPassword("")
    setPerson(result.person)
  }

  function exit() {
    clearAdmin()
    setPerson(null)
    setPassword("")
    setError(null)
  }

  if (!ready) {
    return (
      <p className={styles.loading}>
        <Spinner label="Comprobando la sesión" /> Comprobando la sesión…
      </p>
    )
  }

  if (person) {
    return (
      <div className={styles.page}>
        <header className={styles.intro}>
          <h1>Gestión</h1>
        </header>
        <Card eyebrow="Sesión de gerencia" title={person.name}>
          <p>El panel de incidencias se verá aquí en el siguiente paso.</p>
          <Button variant="ghost" size="lg" fullWidth onClick={exit}>
            Salir
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Gestión</h1>
        <p className={styles.lead}>Entra con tu contraseña. Así queda registrado quién hace cada cambio.</p>
      </header>
      <Card title="¿Quién eres?">
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.choices} role="radiogroup" aria-label="Persona">
            {MANAGERS.map((item) => (
              <Button key={item.slug} type="button" size="lg" fullWidth variant={slug === item.slug ? "primary" : "secondary"} onClick={() => setSlug(item.slug)}>
                {item.name}
              </Button>
            ))}
          </div>
          <Input
            label="Contraseña"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && <Alert tone="error">{error}</Alert>}
          <Button type="submit" size="lg" fullWidth loading={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  )
}
