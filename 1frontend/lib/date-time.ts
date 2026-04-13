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

export function validateDateWindow(params: {
  start?: string
  end?: string
  type: 'date' | 'datetime-local'
  startLabel: string
  endLabel: string
}) {
  const { start, end, type, startLabel, endLabel } = params
  const nowValue =
    type === 'datetime-local'
      ? getCurrentDateTimeInputValue()
      : getCurrentDateInputValue()

  if (start && start < nowValue) {
    return `${startLabel} bugunden once olamaz.`
  }

  if (end && end < nowValue) {
    return `${endLabel} bugunden once olamaz.`
  }

  if (start && end && end < start) {
    return `${endLabel}, ${startLabel.toLowerCase()} degerinden once olamaz.`
  }

  return null
}
