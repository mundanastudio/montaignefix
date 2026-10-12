import { useEffect, useRef, useState } from "react"
import styles from "./PinPad.module.css"
import { PIN_LENGTH } from "../../domain/pin"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "borrar"]

export function PinPad({ busy, onSubmit }: { busy: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("")
  const pinRef = useRef("")
  const wasBusy = useRef(false)

  useEffect(() => {
    if (wasBusy.current && !busy) {
      pinRef.current = ""
      setPin("")
    }
    wasBusy.current = busy
  }, [busy])

  function addDigit(digit: string) {
    if (busy || pinRef.current.length >= PIN_LENGTH) return
    pinRef.current += digit
    setPin(pinRef.current)
    if (pinRef.current.length === PIN_LENGTH) onSubmit(pinRef.current)
  }

  function backspace() {
    if (busy) return
    pinRef.current = pinRef.current.slice(0, -1)
    setPin(pinRef.current)
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") addDigit(event.key)
      if (event.key === "Backspace") backspace()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  return (
    <div className={styles.pad}>
      <p className={styles.dots} aria-live="polite">
        <span className="visually-hidden">{pin.length} de {PIN_LENGTH} cifras</span>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span key={index} className={index < pin.length ? styles.filled : styles.empty} />
        ))}
      </p>
      <div className={styles.keys}>
        {KEYS.map((key) =>
          key === "" ? (
            <span key="gap" />
          ) : (
            <button
              key={key}
              type="button"
              className={styles.key}
              disabled={busy}
              onClick={() => (key === "borrar" ? backspace() : addDigit(key))}
              aria-label={key === "borrar" ? "Borrar" : key}
            >
              {key === "borrar" ? "Borrar" : key}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
