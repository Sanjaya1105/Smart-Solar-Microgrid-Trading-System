type Booking = { id: string; name: string; person: string; station: string; status: string; startUtc?: string; endUtc?: string }
type Filters = { status: string; query: string; from: string; to: string }

// Presentation filtering only; the API remains responsible for booking eligibility.
export function filterReservations<T extends Booking>(bookings: T[], filters: Filters, now = Date.now()): T[] {
  if (filters.from && filters.to && filters.from > filters.to) return []
  const start = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity
  const end = filters.to ? new Date(`${filters.to}T23:59:59.999`).getTime() : Infinity
  const query = filters.query.trim().toLowerCase()
  return bookings.filter((item) => {
    const ended = !!item.endUtc && new Date(item.endUtc).getTime() <= now
    const closed = ['Completed', 'Cancelled', 'Rejected'].includes(item.status)
    if (filters.status === 'Current' && (closed || ended)) return false
    if (filters.status === 'History' && !closed && !ended) return false
    if (!['All', 'Current', 'History'].includes(filters.status) && item.status !== filters.status) return false
    if (query && !`${item.id} ${item.name} ${item.person} ${item.station}`.toLowerCase().includes(query)) return false
    if (filters.from || filters.to) {
      if (!item.startUtc) return false
      const scheduled = new Date(item.startUtc).getTime()
      if (!Number.isFinite(scheduled) || scheduled < start || scheduled > end) return false
    }
    return true
  })
}

export function countApprovedFuture(bookings: Booking[], now = Date.now()): number {
  return bookings.filter((item) => item.status === 'Approved' && !!item.startUtc && new Date(item.startUtc).getTime() > now).length
}
