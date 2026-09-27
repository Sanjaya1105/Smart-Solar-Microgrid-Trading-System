import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { apiRequest } from './api'

type User = { id: string; nic: string; fullName: string; email: string; phone: string; address: string; role: string; status: string }
type Station = { id: string; name: string; address: string; latitude: number; longitude: number; capacityKwh: number; batteryStorageSlots: number; operatingHours: string; operatorUserId: string | null }
type Slot = { id: string; stationId: string; startUtc: string; endUtc: string; totalCapacity: number; reservedCapacity: number; status: string }
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed. Please try again.'
const localDate = (value: string) => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

function Dialog({ title, children, onClose, busy = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  return <div className="modal-backdrop"><section className="form-modal station-form-modal" role="dialog" aria-modal="true" aria-label={title}><button type="button" className="modal-close" aria-label="Close" disabled={busy} onClick={onClose}>×</button><h2>{title}</h2>{children}</section></div>
}

export function PeopleManagement({ token, onChanged }: { token: string; onChanged: () => void }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState(false)
  const [version, setVersion] = useState(0)
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('Prosumer')
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<User | 'staff' | 'prosumer' | null>(null)
  useEffect(() => {
    let cancelled = false
    apiRequest('/api/users', token).then((data) => {
      if (!Array.isArray(data)) throw new Error('Invalid user response.')
      if (!cancelled) setUsers(data)
    }).catch((e) => { if (!cancelled) setError(message(e)) }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token, version])
  const changeStatus = async (user: User, next: string) => {
    if (!window.confirm(`${next === 'Inactive' ? 'Deactivate' : 'Activate'} ${user.fullName}?`)) return
    setWorking(true); setError('')
    try {
      await apiRequest(`/api/users/${user.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status: next }) })
      onChanged()
    } catch (e) { setError(message(e)) } finally { setWorking(false) }
  }
  const visible = users.filter((user) => (!role || user.role === role) && (!status || user.status === status) && `${user.fullName} ${user.nic} ${user.email}`.toLowerCase().includes(query.toLowerCase()))
  return <><section className="page-intro"><div><p className="eyebrow">ACCESS & TRUST</p><h1>People & access</h1><p className="muted">Manage profiles, pending activation and account status.</p></div><div className="row-actions d-flex flex-wrap gap-2 align-items-center"><button className="primary-button" onClick={() => setEditing('prosumer')}>Add prosumer</button><button className="primary-button" onClick={() => setEditing('staff')}>Add staff</button></div></section>
    <div className="management-filters d-flex flex-wrap gap-3"><label>Search<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, NIC or email" /></label><label>Role<select value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{['Prosumer', 'Backoffice', 'GridOperator'].map((r) => <option key={r}>{r}</option>)}</select></label><label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['Pending', 'Active', 'DeactivationRequested', 'Inactive'].map((s) => <option key={s}>{s}</option>)}</select></label></div>
    {error && <div role="alert" className="form-error">{error} <button className="text-button" onClick={() => { setError(''); setLoading(true); setVersion((v) => v + 1) }}>Retry</button></div>}
    <section className="panel">{loading ? <p role="status">Loading accounts...</p> : <><p className="muted">{visible.length} accounts · {users.filter((u) => u.role === 'Prosumer' && u.status === 'Pending').length} prosumers pending activation</p>{!visible.length && <p>No matching accounts.</p>}{visible.map((user) => <div className="person-row" key={user.id}><div><strong>{user.fullName}</strong><p>{user.nic} · {user.email}</p><p>{user.role} · {user.phone} · {user.address}</p></div><span className={`status ${user.status.toLowerCase()}`}>{user.status}</span><div className="row-actions d-flex flex-wrap gap-2 align-items-center"><button className="reservation-action action-edit" disabled={working} onClick={() => setEditing(user)}>Edit</button>{user.status !== 'Active' && <button className="reservation-action action-approve" disabled={working} onClick={() => changeStatus(user, 'Active')}>{user.status === 'Inactive' ? 'Reactivate' : 'Activate'}</button>}{user.status !== 'Inactive' && <button className="reservation-action action-cancel" disabled={working} onClick={() => changeStatus(user, 'Inactive')}>Deactivate</button>}</div></div>)}</>}</section>
    {editing && <UserEditor key={typeof editing === 'string' ? editing : editing.id} token={token} editing={editing} onClose={() => setEditing(null)} onSaved={onChanged} />}
  </>
}

function UserEditor({ token, editing, onClose, onSaved }: { token: string; editing: User | 'staff' | 'prosumer'; onClose: () => void; onSaved: () => void }) {
  const user = typeof editing === 'string' ? null : editing
  const [form, setForm] = useState({ fullName: user?.fullName ?? '', nic: user?.nic ?? '', email: user?.email ?? '', phone: user?.phone ?? '', address: user?.address ?? '', password: '', role: 'GridOperator' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('')
    try {
      const body = user ? { fullName: form.fullName, email: form.email, phone: form.phone, address: form.address } : form
      await apiRequest(user ? `/api/users/${user.id}` : `/api/users/${editing === 'staff' ? 'staff' : 'prosumers'}`, token, { method: user ? 'PUT' : 'POST', body: JSON.stringify(body) })
      onSaved()
    } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <Dialog title={user ? 'Edit profile' : editing === 'staff' ? 'Add staff' : 'Add prosumer'} onClose={onClose} busy={busy}><form className="booking-form" onSubmit={submit}>
    <label>NIC<input required readOnly={!!user} minLength={9} maxLength={12} value={form.nic} onChange={(e) => update('nic', e.target.value)} /></label>
    <label>Full name<input required maxLength={100} value={form.fullName} onChange={(e) => update('fullName', e.target.value)} /></label><label>Email<input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} /></label><label>Phone<input required type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} /></label><label>Address<input required maxLength={250} value={form.address} onChange={(e) => update('address', e.target.value)} /></label>
    {!user && <label>Initial password<input required type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} /></label>}{editing === 'staff' && <label>Role<select value={form.role} onChange={(e) => update('role', e.target.value)}><option value="GridOperator">Grid Operator</option><option value="Backoffice">Backoffice</option></select></label>}{editing === 'prosumer' && <p className="muted">The new account will be Pending. Activate it from the account list.</p>}
    {error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save account'}</button>
  </form></Dialog>
}

export function StationManagement({ stationId, token, role, onClose, onChanged }: { stationId: string; token: string; role: string; onClose: () => void; onChanged: () => void }) {
  const [station, setStation] = useState<Station | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [operators, setOperators] = useState<User[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [editing, setEditing] = useState<Slot | 'new' | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([apiRequest(`/api/stations/${stationId}`, token), apiRequest(`/api/stations/slots?stationId=${stationId}&availableOnly=false`, token), role === 'Backoffice' ? apiRequest('/api/users?role=GridOperator&status=Active', token) : Promise.resolve([])])
      .then(([node, data, people]) => { if (!cancelled) { setStation(node); setSlots(data); setOperators(people) } })
      .catch((e) => { if (!cancelled) setError(message(e)) })
    return () => { cancelled = true }
  }, [stationId, token, role, version])
  const run = async (path: string, method: string, body?: object) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await apiRequest(path, token, { method, ...(body ? { body: JSON.stringify(body) } : {}) }); setNotice('Saved successfully.'); setVersion((v) => v + 1) }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  const field = (key: keyof Station, value: string | number | null) => setStation((s) => s ? { ...s, [key]: value } : s)
  return <Dialog title="Station & schedule" busy={busy} onClose={() => { onClose(); onChanged() }}>
    {error && <p role="alert" className="form-error">{error} <button type="button" className="text-button" onClick={() => { setError(''); setVersion((v) => v + 1) }}>Retry</button></p>}{notice && <p role="status" className="notice">{notice}</p>}
    {!station ? <p>Loading station...</p> : <><form className="booking-form" onSubmit={(e) => { e.preventDefault(); void run(`/api/stations/${stationId}`, 'PUT', station) }}>
      <label>Name<input required value={station.name} onChange={(e) => field('name', e.target.value)} /></label><label>Address<input required value={station.address} onChange={(e) => field('address', e.target.value)} /></label>
      <div className="form-two"><label>Latitude<input required type="number" step="any" min={-90} max={90} value={station.latitude} onChange={(e) => field('latitude', e.target.valueAsNumber)} /></label><label>Longitude<input required type="number" step="any" min={-180} max={180} value={station.longitude} onChange={(e) => field('longitude', e.target.valueAsNumber)} /></label></div>
      <div className="form-two"><label>Capacity (kWh)<input required type="number" min="0.01" step="any" value={station.capacityKwh} onChange={(e) => field('capacityKwh', e.target.valueAsNumber)} /></label><label>Battery slots<input required type="number" min={1} value={station.batteryStorageSlots} onChange={(e) => field('batteryStorageSlots', e.target.valueAsNumber)} /></label></div>
      <label>Operating hours<input required value={station.operatingHours} onChange={(e) => field('operatingHours', e.target.value)} /></label>
      {role === 'Backoffice' && <label>Operator<select value={station.operatorUserId ?? ''} onChange={(e) => field('operatorUserId', e.target.value || null)}><option value="">Unassigned</option>{station.operatorUserId && !operators.some((u) => u.id === station.operatorUserId) && <option value={station.operatorUserId}>Current operator ({station.operatorUserId})</option>}{operators.map((u) => <option value={u.id} key={u.id}>{u.fullName}</option>)}</select></label>}
      <button className="primary-button" disabled={busy}>Save station</button>
    </form><hr /><div className="panel-heading d-flex justify-content-between align-items-center"><h3>Booking slots</h3><button type="button" className="reservation-action action-approve" disabled={busy} onClick={() => setEditing('new')}>Add slot</button></div>
    {!slots.length && <p className="muted">No slots created.</p>}{slots.map((slot) => <article className="slot-entry" key={slot.id}><strong>{new Date(slot.startUtc).toLocaleString()} – {new Date(slot.endUtc).toLocaleString()}</strong><p>{slot.reservedCapacity}/{slot.totalCapacity} reserved · {slot.status}</p><div className="row-actions d-flex flex-wrap gap-2 align-items-center"><button className="reservation-action action-edit" disabled={busy} onClick={() => setEditing(slot)}>Edit</button><button className="reservation-action action-approve" disabled={busy || (slot.status !== 'Unavailable' && slot.reservedCapacity >= slot.totalCapacity)} onClick={() => void run(`/api/stations/slots/${slot.id}/status`, 'PATCH', { status: slot.status === 'Unavailable' ? 'Available' : 'Unavailable' })}>{slot.status === 'Unavailable' ? 'Make available' : 'Mark unavailable'}</button><button className="reservation-action action-cancel" disabled={busy} onClick={() => { if (window.confirm('Delete this slot? The server will reject slots with reservation history.')) void run(`/api/stations/slots/${slot.id}`, 'DELETE') }}>Delete</button></div></article>)}</>}
    {editing && <SlotEditor key={editing === 'new' ? 'new' : editing.id} token={token} stationId={stationId} slot={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setVersion((v) => v + 1); setNotice('Slot saved successfully.') }} />}
  </Dialog>
}

function SlotEditor({ token, stationId, slot, onClose, onSaved }: { token: string; stationId: string; slot?: Slot; onClose: () => void; onSaved: () => void }) {
  const [start, setStart] = useState(slot ? localDate(slot.startUtc) : '')
  const [end, setEnd] = useState(slot ? localDate(slot.endUtc) : '')
  const [capacity, setCapacity] = useState(slot?.totalCapacity.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { await apiRequest(`/api/stations/slots${slot ? `/${slot.id}` : ''}`, token, { method: slot ? 'PUT' : 'POST', body: JSON.stringify({ stationId, startUtc: new Date(start).toISOString(), endUtc: new Date(end).toISOString(), totalCapacity: Number(capacity) }) }); onSaved() }
    catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <Dialog title={slot ? 'Edit slot' : 'Create slot'} busy={busy} onClose={onClose}><form className="booking-form" onSubmit={submit}><label>Start (local time)<input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label><label>End (local time)<input required type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label><label>Capacity<input required type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Save slot'}</button></form></Dialog>
}
