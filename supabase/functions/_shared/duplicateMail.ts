import { normalizeEmail } from "./allowedEmails.ts"

export function sameRequesterEmail(a: string, b: string): boolean {
  const left = normalizeEmail(a)
  const right = normalizeEmail(b)
  return left !== "" && left === right
}

export function uniqueClosedRecipients<T extends { requester_email: string }>(
  originalEmail: string,
  duplicates: T[],
): T[] {
  const seen = new Set([normalizeEmail(originalEmail)])
  const picked: T[] = []
  for (const row of duplicates) {
    const email = normalizeEmail(row.requester_email)
    if (!email || seen.has(email)) continue
    seen.add(email)
    picked.push(row)
  }
  return picked
}
