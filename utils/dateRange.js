// Build an ISO date-range filter from common query params.
// Supports: from, to, year, month (1-12), day (1-31). All are optional.
// Returns { fromISO, toISO } where toISO is exclusive upper bound.
const pad = n => String(n).padStart(2, '0')

const buildDateRange = (query = {}) => {
  const { from, to, year, month, day } = query

  if (from || to) {
    return {
      fromISO: from ? new Date(from).toISOString() : null,
      toISO: to ? new Date(to).toISOString() : null
    }
  }

  if (year) {
    const y = parseInt(year, 10)
    if (month) {
      const m = parseInt(month, 10)
      if (day) {
        const d = parseInt(day, 10)
        const start = new Date(Date.UTC(y, m - 1, d))
        const end = new Date(Date.UTC(y, m - 1, d + 1))
        return { fromISO: start.toISOString(), toISO: end.toISOString() }
      }
      const start = new Date(Date.UTC(y, m - 1, 1))
      const end = new Date(Date.UTC(y, m, 1))
      return { fromISO: start.toISOString(), toISO: end.toISOString() }
    }
    const start = new Date(Date.UTC(y, 0, 1))
    const end = new Date(Date.UTC(y + 1, 0, 1))
    return { fromISO: start.toISOString(), toISO: end.toISOString() }
  }

  return { fromISO: null, toISO: null }
}

const inRange = (iso, fromISO, toISO) => {
  if (!iso) return false
  if (fromISO && iso < fromISO) return false
  if (toISO && iso >= toISO) return false
  return true
}

const bucketKey = (iso, bucket) => {
  const d = new Date(iso)
  const y = d.getUTCFullYear()
  const m = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  if (bucket === 'year') return `${y}`
  if (bucket === 'day') return `${y}-${m}-${day}`
  return `${y}-${m}` // default: month
}

module.exports = { buildDateRange, inRange, bucketKey }
