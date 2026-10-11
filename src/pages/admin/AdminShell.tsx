import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { Alert } from "../../components/ui/Alert"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Input } from "../../components/ui/Field"
import { Spinner } from "../../components/ui/Spinner"
import { adminPost, type AdminResponse } from "../../lib/adminApi"
import { adminToken, clearAdmin, currentSession, loginAdmin, type Person } from "../../lib/authApi"
import access from "../Access.module.css"
import styles from "./Admin.module.css"

const MANAGERS = [
  { slug: "fran", name: "Fran" },
  { slug: "curro", name: "Curro" },
]

export interface AdminContextValue {
  person: Person
  pendingCount: number | null
  call: <T>(name: string, body?: Record<string, unknown>) => Promise<AdminResponse<T>>
}

export function AdminShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [ready, setReady] = useState(!adminToken())
  const [person, setPerson] = useState<Person | null>(null)
  const [slug, setSlug] = useState("fran")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [reporting, setReporting] = useState(false)
  const [reportNotice, setReportNotice] = useState<string | null>(null)

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

  const call = useCallback(function callAdmin<T>(name: string, body: Record<string, unknown> = {}): Promise<AdminResponse<T>> {
    return adminPost<T & { pendingCount?: number }>(name, body).then((result) => {
      if (!result.ok) {
        if (result.expired) {
          clearAdmin()
          setPerson(null)
          setError(result.message)
        }
        return result
      }
      if (typeof result.pendingCount === "number") setPendingCount(result.pendingCount)
      return result
    })
  }, [])

  useEffect(() => {
    if (!person) return
    void call("admin-tickets", { countsOnly: true })
  }, [person, call])

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

  async function sendReport() {
    setReporting(true)
    setReportNotice(null)
    const result = await call<{ sent?: boolean; emailError?: string | null }>("admin-report-send")
    setReporting(false)
    if (!result.ok) {
      if (!result.expired) setReportNotice(result.message)
      return
    }
    setReportNotice(result.sent ? "Informe de los últimos 7 días enviado a Fran." : result.emailError ?? "No se ha podido enviar el informe.")
  }

  function exit() {
    clearAdmin()
    setPerson(null)
    setPassword("")
    setPendingCount(null)
    setError(null)
  }

  if (!ready) {
    return (
      <p className={access.loading}>
        <Spinner label="Comprobando la sesión" /> Comprobando la sesión…
      </p>
    )
  }

  if (!person) {
    return (
      <div className={access.page}>
        <header className={access.intro}>
          <h1>Gestión</h1>
          <p className={access.lead}>Entra con tu contraseña. Así queda registrado quién hace cada cambio.</p>
        </header>
        <Card title="¿Quién eres?">
          <form className={access.form} onSubmit={(event) => void submit(event)}>
            <div className={access.choices} role="radiogroup" aria-label="Persona">
              {MANAGERS.map((item) => (
                <Button
                  key={item.slug}
                  type="button"
                  size="lg"
                  fullWidth
                  variant={slug === item.slug ? "primary" : "secondary"}
                  aria-pressed={slug === item.slug}
                  onClick={() => setSlug(item.slug)}
                >
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

  const shopping = location.pathname.startsWith("/gestion/compra")
  const context: AdminContextValue = { person, pendingCount, call }

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div>
          <h1>Gestión</h1>
          <p className={styles.who}>{person.name}</p>
        </div>
        <Button variant="ghost" onClick={exit}>
          Salir
        </Button>
      </div>
      <nav className={styles.nav} aria-label="Secciones de gestión">
        <Link to="/gestion" className={!shopping ? `${styles.navLink} ${styles.navOn}` : styles.navLink} aria-current={!shopping ? "page" : undefined}>
          Incidencias
        </Link>
        <Link
          to="/gestion/compra"
          className={shopping ? `${styles.navLink} ${styles.navOn}` : styles.navLink}
          aria-current={shopping ? "page" : undefined}
        >
          Lista de la compra
          <span className={styles.count}>{pendingCount ?? "…"}</span>
          <span className="visually-hidden">artículos pendientes</span>
        </Link>
        <Button variant="accent" onClick={() => navigate("/")}>
          Crear incidencia
        </Button>
        <Button variant="secondary" disabled={reporting} onClick={() => void sendReport()}>
          {reporting ? "Enviando…" : "Enviar informe"}
        </Button>
      </nav>
      {reportNotice && <Alert tone={reportNotice.startsWith("Informe de los últimos") ? "success" : "error"}>{reportNotice}</Alert>}
      <Outlet context={context} />
    </div>
  )
}
