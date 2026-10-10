import { useCallback, useEffect, useState } from "react"
import { Alert } from "../components/ui/Alert"
import { Button } from "../components/ui/Button"
import { Card } from "../components/ui/Card"
import { PinPad } from "../components/auth/PinPad"
import { Spinner } from "../components/ui/Spinner"
import {
  clearTeam,
  currentSession,
  loginWithPin,
  savedPeople,
  selectPerson,
  teamGate,
  teamToken,
  type Person,
} from "../lib/authApi"
import styles from "./Access.module.css"

type Step = "loading" | "pin" | "who" | "in"

export function TeamAccess() {
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

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <h1>Equipo de mantenimiento</h1>
        <p className={styles.lead}>Entra con el PIN del equipo y di quién eres.</p>
      </header>

      {step === "loading" && (
        <p className={styles.loading}>
          <Spinner label="Comprobando la sesión" /> Comprobando la sesión…
        </p>
      )}

      {step === "pin" && (
        <Card title="PIN del equipo">
          <PinPad busy={busy} onSubmit={submitPin} />
          {error && <Alert tone="error">{error}</Alert>}
        </Card>
      )}

      {step === "who" && (
        <Card title="¿Quién eres?">
          <div className={styles.choices}>
            {people.map((item) => (
              <Button key={item.slug} size="lg" fullWidth disabled={busy} onClick={() => void choose(item.slug)}>
                {item.name}
              </Button>
            ))}
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button variant="ghost" fullWidth onClick={exit}>
            Volver al PIN
          </Button>
        </Card>
      )}

      {step === "in" && person && !changing && (
        <Card eyebrow="Sesión del equipo" title={person.name}>
          <p>El listado de tareas se verá aquí en el siguiente paso.</p>
          <div className={styles.choices}>
            <Button variant="secondary" size="lg" fullWidth onClick={() => setChanging(true)}>
              Cambiar de persona
            </Button>
            <Button variant="ghost" size="lg" fullWidth onClick={exit}>
              Salir
            </Button>
          </div>
        </Card>
      )}

      {step === "in" && changing && (
        <Card title="¿Quién eres?">
          <div className={styles.choices}>
            {people.map((item) => (
              <Button key={item.slug} size="lg" fullWidth variant={item.slug === person?.slug ? "secondary" : "primary"} disabled={busy} onClick={() => void choose(item.slug)}>
                {item.name}
              </Button>
            ))}
          </div>
          {error && <Alert tone="error">{error}</Alert>}
          <Button variant="ghost" fullWidth onClick={() => setChanging(false)}>
            Cancelar
          </Button>
        </Card>
      )}
    </div>
  )
}
