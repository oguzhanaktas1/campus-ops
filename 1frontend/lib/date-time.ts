export function getCurrentDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getCurrentDateTimeInputValue() {
  const now = new Date()
  now.setSeconds(0, 0)
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export interface DateWindowMessages {
  startPast: string
  endPast: string
  endBeforeStart: string
  endSameAsStart: string
}

export function validateDateWindow(params: {
  start?: string
  end?: string
  type: 'date' | 'datetime-local'
  messages?: DateWindowMessages
  /** @deprecated use messages */
  startLabel?: string
  /** @deprecated use messages */
  endLabel?: string
}) {
  const { start, end, type, messages, startLabel = 'Başlangıç', endLabel = 'Bitiş' } = params
  const nowValue =
    type === 'datetime-local'
      ? getCurrentDateTimeInputValue()
      : getCurrentDateInputValue()

  if (start && start < nowValue) {
    return messages?.startPast ?? `${startLabel} geçmiş bir zaman olamaz.`
  }

  if (end && end < nowValue) {
    return messages?.endPast ?? `${endLabel} geçmiş bir zaman olamaz.`
  }

  if (start && end && end === start) {
    return messages?.endSameAsStart ?? `${endLabel} ${startLabel.toLowerCase()} ile aynı olamaz.`
  }

  if (start && end && end < start) {
    return messages?.endBeforeStart ?? `${endLabel} ${startLabel.toLowerCase()} değerinden önce olamaz.`
  }

  return null
}
