export const CLOSE_MESSAGE_MAX = 500

export function trimmedCloseMessage(value: string): string {
  return value.trim()
}

export function closeMessageReady(value: string): boolean {
  return trimmedCloseMessage(value).length <= CLOSE_MESSAGE_MAX
}
