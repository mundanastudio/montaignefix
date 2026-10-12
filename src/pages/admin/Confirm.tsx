import type { ReactNode } from "react"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"

export function Confirm({
  open,
  title,
  children,
  acceptLabel,
  busy,
  danger = false,
  acceptDisabled = false,
  onCancel,
  onAccept,
}: {
  open: boolean
  title: string
  children: ReactNode
  acceptLabel: string
  busy: boolean
  danger?: boolean
  acceptDisabled?: boolean
  onCancel: () => void
  onAccept: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={() => {
        if (!busy) onCancel()
      }}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} disabled={acceptDisabled} onClick={onAccept}>
            {acceptLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  )
}
