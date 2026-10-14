import styles from "./TicketListFields.module.css"

interface MaterialRow {
  description: string
  status: "pendiente" | "comprado"
}

export function TicketListFields({
  description,
  notes,
  location,
  materials,
}: {
  description: string
  notes?: string | null
  location: string
  materials?: MaterialRow[] | null
}) {
  const note = notes?.replace(/\s+/g, " ").trim()
  const items = materials ?? []
  return (
    <>
      <p className={styles.line}>
        <strong>Reparación: </strong>
        {description}
      </p>
      {note ? (
        <p className={styles.line}>
          <strong>Observaciones: </strong>
          {note}
        </p>
      ) : null}
      <p className={styles.line}>
        <strong>Lugar: </strong>
        {location}
      </p>
      <p className={styles.line}>
        <strong>Materiales: </strong>
        {items.length === 0 && "Sin materiales"}
        {items.map((item, index) => (
          <span key={`${item.description}-${index}`}>
            {index > 0 && " / "}
            {item.description}{" "}
            <span className={item.status === "pendiente" ? styles.pending : styles.bought}>
              {item.status === "pendiente" ? "Pendiente" : "Comprado"}
            </span>
          </span>
        ))}
      </p>
    </>
  )
}
