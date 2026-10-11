import { useCallback, useEffect, useState } from "react"
import { Outlet, useLocation, useNavigate } from "react-router-dom"
import { PinPad } from "../../components/auth/PinPad"
import { Alert } from "../../components/ui/Alert"
import { Button } from "../../components/ui/Button"
import { Card } from "../../components/ui/Card"
import { Spinner } from "../../components/ui/Spinner"
import {
  clearTeam,
  currentSession,
  loginWithPin,
  savedPeople,
  selectPerson,
  teamGate,
  teamToken,
  type Person,
} from "../../lib/authApi"
import { teamPost, type TeamResponse } from "../../lib/teamApi"
import access from "../Access.module.css"
import styles from "./Team.module.css"

type Step = "loading" | "pin" | "who" | "in"

export interface TeamContextValue {
  person: Person
  call: <T>(name: string, body?: Record<string, unknown>) => Promise<TeamResponse<T>>
}

export function TeamShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(teamToken() ? "loading" : teamGate() ? "who" : "pin")
  const [people, setPeople] = useState<Person[]>(savedPeople)
  const [person, setPerson] = useState<Person | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [changing, setChanging] = useState(false)

  useEffect(() => {
    if (!teamToken()) return
    let active = true
    currentSession("team").then((result) => {
      if (!active) return
      if (!result.ok) {
        if (!result.message.includes("conexión")) clearTeam()
        setError(result.message || null)
        setStep("pin")
        return
      }
      setPerson(result.person)
      if (result.people.length > 0) setPeople(result.people)
      setStep("in")
    })
    return () => {
      active = false
    }
  }, [])

  const call = useCallback(function callTeam<T>(name: string, body: Record<string, unknown> = {}): Promise<TeamResponse<T>> {
    return teamPost<T>(name, body).then((result) => {
      if (!result.ok && result.expired) {
        clearTeam()
        setPerson(null)
        setError(result.message)
        setStep("pin")
      }
      return result
    })
  }, [])

  const submitPin = useCallback(async (pin: string) => {
    setBusy(true)
    setError(null)
    const result = await loginWithPin(pin)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPeople(result.people)
    setChanging(false)
    setStep("who")
  }, [])

  async function choose(slug: string) {
    setBusy(true)
    setError(null)
    const result = await selectPerson(slug)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      if (result.message.includes("PIN")) setStep("pin")
      return
    }
    setPerson(result.person)
    setPeople(result.people)
    setChanging(false)
    setStep("in")
  }

  function exit() {
    clearTeam()
    setPerson(null)
    setChanging(false)
    setError(null)
    setStep("pin")
  }

  if (step !== "in" || !person || changing) {
    return (
      <div className={access.page}>
        <header className={access.intro}>
          <h1>Equipo de mantenimiento</h1>
          <p className={access.lead}>Entra con el PIN del equipo y di quién eres.</p>
        </header>
        {step === "loading" && (
          <p className={access.loading}>
            <Spinner label="Comprobando la sesión" /> Comprobando la sesión…
          </p>
        )}
        {step === "pin" && (
          <Card title="PIN del equipo">
            <PinPad busy={busy} onSubmit={submitPin} />
            {error && <Alert tone="error">{error}</Alert>}
          </Card>
        )}
        {(step === "who" || changing) && (
          <Card title="¿Quién eres?">
            <div className={access.choices}>
              {people.map((item) => (
                <Button
                  key={item.slug}
                  size="lg"
                  fullWidth
                  variant={item.slug === person?.slug ? "secondary" : "primary"}
                  disabled={busy}
                  onClick={() => void choose(item.slug)}
                >
                  {item.name}
                </Button>
              ))}
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <Button variant="ghost" fullWidth onClick={changing ? () => setChanging(false) : exit}>
              {changing ? "Cancelar" : "Volver al PIN"}
            </Button>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <div>
          <h1>Equipo</h1>
          <p className={styles.who}>{person.name}</p>
        </div>
        <Button variant="ghost" onClick={exit}>
          Salir
        </Button>
      </div>
      {location.pathname !== "/equipo" ? (
        <div className={styles.toolbar}>
          <Button variant="accent" onClick={() => navigate({ pathname: "/equipo", search: location.search })}>
            ⬅️ Volver a las tareas
          </Button>
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Cambiar de persona
          </Button>
          <Button variant="accent" onClick={() => navigate("/")}>
            Crear incidencia
          </Button>
        </div>
      ) : (
        <div className={styles.toolbar}>
          <Button variant="secondary" onClick={() => setChanging(true)}>
            Cambiar de persona
          </Button>
          <Button variant="accent" onClick={() => navigate("/")}>
            Crear incidencia
          </Button>
        </div>
      )}
      <Outlet context={{ person, call } satisfies TeamContextValue} />
    </div>
  )
}
