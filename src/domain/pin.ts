/** 4 salvo que el build tenga VITE_PIN_LENGTH=6. El servidor debe llevar el mismo valor en MF_PIN_LENGTH. */
export const PIN_LENGTH = import.meta.env.VITE_PIN_LENGTH === "6" ? 6 : 4
