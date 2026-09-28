import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Activity, ArrowUpRight, BatteryCharging, CalendarDays, Check, ChevronRight, CircleHelp, Grid2X2, LayoutDashboard, LogOut, MapPin, Menu, Pencil, Plus, QrCode, Ban, LoaderCircle, ScanLine, Search, Settings2, ShieldCheck, SunMedium, Users, X, Zap } from 'lucide-react'
import './App.css'
import { apiRequest } from './api'
import { filterReservations, countApprovedFuture } from './reservationViews'
import { PeopleManagement, StationManagement } from './Management'
import QrScanner from 'qr-scanner'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

const stationMarker = L.divIcon({ className: 'station-map-marker', html: '<span>☀</span>', iconSize: [30, 30], iconAnchor: [15, 30] })
function LocationPicker({ latitude, longitude, onPick }: { latitude: string; longitude: string; onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(event) { onPick(Number(event.latlng.lat.toFixed(6)), Number(event.latlng.lng.toFixed(6))) } })
  return latitude && longitude ? <Marker position={[Number(latitude), Number(longitude)]} icon={stationMarker} /> : null
}

type Role = 'Backoffice' | 'GridOperator' | 'Prosumer'
type Page = 'overview' | 'stations' | 'reservations' | 'people' | 'settings'
type Station = { id?: string; name: string; area: string; status: string; slots: string; capacityKwh?: number; operatingHours?: string }
type Reservation = { id: string; name: string; person: string; station: string; stationId: string; slotId?: string; transactionType: string; startUtc?: string; endUtc?: string; time: string; amount: string; status: string }
type Slot = { id: string; stationId: string; startUtc: string; endUtc: string; totalCapacity: number; reservedCapacity: number; status: string }
type OperatorOption = { id: string; fullName: string }
function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (normalized === 'prosumer') return 'Prosumer'
  if (normalized === 'gridoperator') return 'GridOperator'
  if (normalized === 'backoffice') return 'Backoffice'
  return null
}

function formatDate(value: string | undefined) {
  if (!value) return 'Scheduled slot'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function transactionLabel(value: unknown) {
  return String(value ?? '').toLowerCase() === 'charging' ? 'Charging' : 'Drop-off'
}

function reservationName(stationName: string, type: unknown) {
  return `${stationName} · ${transactionLabel(type)}`
}

function shortReservationId(id: string) {
  if (!id) return '—'
  return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase()
}

function App() {
  const [role, setRole] = useState<Role>('Backoffice')
  const [page, setPage] = useState<Page>('overview')
  const [token, setToken] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [showRegistration, setShowRegistration] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [showQr, setShowQr] = useState(false)
  const [qrValue, setQrValue] = useState('')
  const [showBooking, setShowBooking] = useState(false)
  const [showStationForm, setShowStationForm] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)
  const [mobileNav, setMobileNav] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [fullName, setFullName] = useState('')
  const [dataState, setDataState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pendingUsers, setPendingUsers] = useState(0)
  const [reloadVersion, setReloadVersion] = useState(0)
  const [dashboard, setDashboard] = useState<{ pendingReservations: number; approvedFutureReservations: number; completedReservations: number; activeStations: number } | null>(null)

  useEffect(() => {
    const savedToken = localStorage.getItem('solargrid.token')
    const savedRole = normalizeRole(localStorage.getItem('solargrid.role'))
    if (savedToken && savedRole) {
      setToken(savedToken)
      setRole(savedRole)
      setFullName(localStorage.getItem('solargrid.fullName') ?? '')
      setLoggedIn(true)
    }
  }, [])

  useEffect(() => {
    if (!loggedIn) return
    let cancelled = false
    Promise.all([apiRequest(role === 'Backoffice' ? '/api/stations?activeOnly=false' : '/api/stations?activeOnly=true', token), apiRequest(role === 'Prosumer' ? '/api/reservations/mine' : '/api/reservations/operations', token), role === 'Backoffice' ? apiRequest('/api/users', token) : Promise.resolve([]), apiRequest('/api/stations/slots?availableOnly=false', token), role === 'Prosumer' ? Promise.resolve(null) : apiRequest('/api/reservations/dashboard', token)])
      .then(([stationData, reservationData, users, slotData, dashboardData]) => {
        if (cancelled) return
        if (!Array.isArray(stationData) || !Array.isArray(reservationData) || !Array.isArray(users)) throw new Error('Unable to load workspace data.')
        if (Array.isArray(stationData)) setStations(stationData.map((station) => ({ id: station.id, name: station.name, area: station.address, status: station.status, slots: station.batteryStorageSlots == null ? 'Slots unavailable' : `${station.batteryStorageSlots} slots`, capacityKwh: station.capacityKwh, operatingHours: station.operatingHours })))
        const names = Array.isArray(users) ? Object.fromEntries(users.map((user) => [user.nic, user.fullName])) : {}
        setDashboard(dashboardData)
        setPendingUsers(users.filter((user) => user.role === 'Prosumer' && user.status === 'Pending').length)
        if (Array.isArray(reservationData)) setReservations(reservationData.map((reservation) => {
          const stationName = Array.isArray(stationData) ? stationData.find((station: { id: string; name: string }) => station.id === reservation.stationId)?.name ?? reservation.stationId : reservation.stationId
          const person = role === 'Prosumer' ? 'You' : names[reservation.prosumerNic] ? `${names[reservation.prosumerNic]} / ${reservation.prosumerNic}` : reservation.prosumerNic
          const slot = (slotData as Slot[]).find((item) => item.id === reservation.slotId)
          return { id: reservation.id, name: reservationName(stationName, reservation.transactionType), person, station: stationName, stationId: reservation.stationId, slotId: reservation.slotId, transactionType: reservation.transactionType, startUtc: slot?.startUtc, endUtc: slot?.endUtc, time: slot ? `${formatDate(slot.startUtc)} - ${formatDate(slot.endUtc)}` : 'Slot unavailable', amount: `${reservation.energyKwh} kWh`, status: reservation.status }
        }))
        setDataState('ready')
      }).catch((error) => { if (!cancelled) { setDataState('error'); setNotice(error instanceof Error ? error.message : 'Unable to load workspace data. Please try again.') } })
    return () => { cancelled = true }
  }, [loggedIn, token, role, reloadVersion])

  const signIn = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice('')
    try { const data = await apiRequest('/api/auth/login', '', { method: 'POST', body: JSON.stringify({ nicOrEmail: email, password }) }); const loginRole = normalizeRole(data.role); if (!loginRole || !data.token) throw new Error('Invalid login response.'); localStorage.setItem('solargrid.token', data.token); localStorage.setItem('solargrid.role', loginRole); localStorage.setItem('solargrid.fullName', data.fullName ?? ''); setFullName(data.fullName ?? ''); setStations([]); setPendingUsers(0); setDataState('loading'); setReservations([]); setPage('overview'); setShowQr(false); setQrValue(''); setToken(data.token); setRole(loginRole); setLoggedIn(true) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to sign in. Please try again.') }
    finally { setBusy(false) }
  }
  if (!loggedIn) return <><LoginScreen email={email} password={password} setEmail={setEmail} setPassword={setPassword} onSubmit={signIn} busy={busy} notice={notice} onRegister={() => setShowRegistration(true)} />{showRegistration && <ProsumerRegistrationModal onClose={() => setShowRegistration(false)} onRegistered={(registeredEmail) => { setShowRegistration(false); setEmail(registeredEmail); setPassword(''); setNotice('Registration successful. Your account is pending Backoffice activation. You can sign in after it is activated.') }} />}</>
  const nav = [{ id: 'overview' as Page, label: 'Overview', icon: LayoutDashboard }, { id: 'stations' as Page, label: 'Solar stations', icon: SunMedium }, { id: 'reservations' as Page, label: 'Reservations', icon: CalendarDays }, ...(role === 'Backoffice' ? [{ id: 'people' as Page, label: 'People & access', icon: Users }] : [])]
  const reload = () => { setDataState('loading'); setReloadVersion((value) => value + 1) }
  const openQr = (value: string) => { setQrValue(value); setShowQr(true) }
  return <div className="app-shell"><aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}><div className="brand"><span className="brand-mark"><SunMedium size={20} /></span><span>solar<span>grid</span></span></div><div className="workspace-label">{role === 'Prosumer' ? 'PROSUMER SPACE' : 'CONTROL ROOM'} <span>{dataState === 'ready' ? 'API' : dataState === 'loading' ? 'LOADING' : 'UNAVAILABLE'}</span></div><nav>{nav.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(id); setMobileNav(false) }}><Icon size={18} /><span>{label}</span>{page === id && <ChevronRight size={15} className="nav-arrow" />}</button>)}</nav><div className="sidebar-bottom"><button className={page === 'settings' ? 'nav-item active' : 'nav-item'} onClick={() => { setPage('settings'); setMobileNav(false) }}><Settings2 size={18} /><span>Settings</span></button><button className="nav-item" onClick={() => { localStorage.removeItem('solargrid.token'); localStorage.removeItem('solargrid.role'); localStorage.removeItem('solargrid.fullName'); setLoggedIn(false); setToken(''); setPassword(''); setFullName(''); setReservations([]); setStations([]); setShowQr(false); setQrValue(''); setShowBooking(false); setShowStationForm(false); setEditingReservation(null); setNotice('') }}><LogOut size={18} /><span>Sign out</span></button><div className="mini-profile"><div className="avatar">{fullName.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2) || role[0]}</div><div><strong>{fullName || role}</strong><small>{role}</small></div><CircleHelp size={16} /></div></div></aside>{mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}<main className="main-content"><header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumbs"><span>Solargrid</span><ChevronRight size={14} /><strong>{page === 'settings' ? 'Settings' : nav.find((item) => item.id === page)?.label}</strong></div><div className="top-actions"><span className="role-badge">{role}</span><button className="icon-button" title="Search reservations" onClick={() => setPage('reservations')}><Search size={18} /></button><button className="help-button" onClick={() => setNotice('Bookings must be within 7 days. Changes and cancellations require 12 hours notice. Contact Backoffice for account activation or support.')}><CircleHelp size={16} /> Help centre</button><div className="avatar">{fullName.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2) || role[0]}</div></div></header><div className="content-wrap">{notice && <div className="notice"><Activity size={16} /> {notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}{page !== 'settings' && dataState === 'loading' && <p className="muted" role="status">Loading workspace data...</p>}{page !== 'settings' && dataState === 'error' && <button className="primary-button" onClick={reload}>Retry loading data</button>}{dataState === 'ready' && page === 'overview' && <Overview dashboard={dashboard} stations={stations} fullName={fullName} pendingUsers={pendingUsers} role={role} setPage={setPage} reservations={reservations} onQr={() => setPage('reservations')} onBook={() => setShowBooking(true)} />}{dataState === 'ready' && page === 'stations' && <Stations stations={stations} role={role} token={token} onAdd={() => setShowStationForm(true)} onChanged={reload} />}{dataState === 'ready' && page === 'reservations' && <Reservations reservations={reservations} role={role} token={token} onQr={() => setNotice('Use the Grid Operator scanning client to scan and complete a reservation.')} onBook={() => setShowBooking(true)} onChanged={reload} onApproved={(value) => openQr(value)} onEdit={(reservation) => setEditingReservation(reservation)} />}{page === 'settings' && <AccountSettings token={token} />}{dataState === 'ready' && page === 'people' && <PeopleManagement token={token} onChanged={reload} />}</div></main>{showQr && <QrModal value={qrValue} onClose={() => setShowQr(false)} />}{showBooking && <BookingModal role={role} stations={stations} token={token} onClose={() => setShowBooking(false)} onCreated={(message) => { setShowBooking(false); setNotice(message); reload() }} />}{editingReservation && <ReservationEditorModal role={role} stations={stations} token={token} reservation={editingReservation} onClose={() => setEditingReservation(null)} onSaved={() => { setEditingReservation(null); setNotice('Reservation updated. It is now waiting for approval; any previous QR code is no longer valid.'); reload() }} />}{showStationForm && <StationModal token={token} onClose={() => setShowStationForm(false)} onSaved={(message) => { setShowStationForm(false); setNotice(message); reload() }} />}</div>
}

function AccountSettings({ token }: { token: string }) {
  const [account, setAccount] = useState<{ fullName: string; email: string } | null>(null)
  const [accountError, setAccountError] = useState('')
  const [retry, setRetry] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  useEffect(() => {
    let cancelled = false
    apiRequest('/api/auth/account', token).then((data) => {
      if (!data || typeof data.fullName !== 'string' || typeof data.email !== 'string') throw new Error('Unable to load account.')
      if (!cancelled) setAccount(data)
    }).catch((error) => { if (!cancelled) setAccountError(error instanceof Error ? error.message : 'Unable to load account.') })
    return () => { cancelled = true }
  }, [token, retry])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError(''); setSuccess('')
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    if (currentPassword === newPassword) { setError('Choose a different new password.'); return }
    setBusy(true)
    try {
      await apiRequest('/api/auth/change-password', token, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setSuccess('Password changed successfully. Use your new password next time you sign in.')
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to change password.') }
    finally { setBusy(false) }
  }
  return <><section className="page-intro"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>Settings</h1><p className="muted">View your account and change your password.</p></div></section>
    <section className="panel" style={{ maxWidth: 520 }}>
      {account ? <div className="booking-form"><label>Name<input readOnly value={account.fullName} /></label><label>Email<input readOnly value={account.email} /></label></div> : accountError ? <div role="alert"><p className="form-error">{accountError}</p><button className="text-button" onClick={() => { setAccountError(''); setRetry((value) => value + 1) }}>Retry</button></div> : <p role="status">Loading account...</p>}
      <form className="booking-form" onSubmit={submit}><h2>Change password</h2>
        <label>Current password<input required disabled={busy} type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
        <label>New password<input required disabled={busy} type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><span className="muted">At least 8 characters.</span></label>
        <label>Confirm new password<input required disabled={busy} type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="notice" role="status">{success}</p>}
        <button className="primary-button" disabled={busy}>{busy ? 'Saving...' : 'Change password'}<ShieldCheck size={16} /></button>
      </form>
    </section></>
}

function ProsumerRegistrationModal({ onClose, onRegistered }: { onClose: () => void; onRegistered: (email: string) => void }) {
  const [form, setForm] = useState({ fullName: '', nic: '', email: '', phone: '', address: '', password: '' })
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setError('')
    if (form.password !== confirmation) { setError('Passwords do not match.'); return }
    if (![form.fullName, form.nic, form.email, form.phone, form.address].every((value) => value.trim())) { setError('Please complete all fields.'); return }
    setBusy(true)
    try {
      await apiRequest('/api/auth/register-prosumer', '', { method: 'POST', body: JSON.stringify({ ...form, fullName: form.fullName.trim(), nic: form.nic.trim(), email: form.email.trim(), phone: form.phone.trim(), address: form.address.trim() }) })
      onRegistered(form.email.trim())
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to register. Please try again.') }
    finally { setBusy(false) }
  }
  return <div className="modal-backdrop" onClick={() => { if (!busy) onClose() }}><div className="form-modal station-form-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title" onClick={(event) => event.stopPropagation()}>
    <button type="button" className="modal-close" aria-label="Close registration" disabled={busy} onClick={onClose}><X size={18} /></button>
    <p className="eyebrow">JOIN SOLARGRID</p><h2 id="registration-title">Register as a prosumer</h2><p className="muted">Create your account. Backoffice must activate it before you can sign in.</p>
    <form className="booking-form" onSubmit={submit}>
      <label>Full name<input autoFocus required maxLength={100} disabled={busy} autoComplete="name" value={form.fullName} onChange={(event) => update('fullName', event.target.value)} /></label>
      <label>NIC<input required minLength={9} maxLength={12} disabled={busy} value={form.nic} onChange={(event) => update('nic', event.target.value)} /></label>
      <label>Email<input required type="email" disabled={busy} autoComplete="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
      <label>Phone<input required type="tel" disabled={busy} autoComplete="tel" value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
      <label>Address<input required maxLength={250} disabled={busy} autoComplete="street-address" value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
      <label>Password<input required type="password" minLength={8} disabled={busy} autoComplete="new-password" value={form.password} onChange={(event) => update('password', event.target.value)} /><span className="muted">At least 8 characters.</span></label>
      <label>Confirm password<input required type="password" minLength={8} disabled={busy} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button wide" disabled={busy}>{busy ? 'Registering...' : 'Create account'}<ArrowUpRight size={16} /></button>
      <button type="button" className="text-button" disabled={busy} onClick={onClose}>Back to sign in</button>
    </form>
  </div></div>
}

function LoginScreen({ email, password, setEmail, setPassword, onSubmit, busy, notice, onRegister }: { onRegister: () => void; email: string; password: string; setEmail: (value: string) => void; setPassword: (value: string) => void; onSubmit: (event: FormEvent) => void; busy: boolean; notice: string }) { return <div className="login-screen"><div className="login-art"><div className="orb orb-one" /><div className="orb orb-two" /><div className="login-art-content"><div className="brand light"><span className="brand-mark"><SunMedium size={20} /></span><span>solar<span>grid</span></span></div><div className="art-copy"><p className="eyebrow">SMART ENERGY OPERATIONS</p><h1>Make every<br /><em>ray</em> count.</h1><p>One calm command centre for stations, bookings, and the people powering tomorrow.</p><div className="energy-line"><span /><span /><span /><span /><span /><span /><span /></div><small>Sign in to view your stations and reservations.</small></div></div></div><div className="login-panel"><div className="login-box"><p className="eyebrow">WELCOME BACK</p><h2>Power the network.</h2><p className="muted">Sign in to your Solargrid workspace.</p><form onSubmit={onSubmit}><label>Email or NIC<input value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><div className="form-row"><span className="muted">Forgot your password? Contact Backoffice for support.</span></div><button className="primary-button wide" disabled={busy}>{busy ? 'Connecting…' : 'Enter workspace'} <ArrowUpRight size={17} /></button></form>{notice && <p className="login-notice">{notice}</p>}<div className="login-footer"><span>New to the network?</span><button type="button" className="text-button" disabled={busy} onClick={onRegister}>Register as a prosumer</button></div></div><div className="login-meta"><span>© {new Date().getFullYear()} Solargrid</span><span><ShieldCheck size={14} /> Secure access</span></div></div></div> }

function Overview({ dashboard, role, fullName, stations, pendingUsers, setPage, reservations, onQr, onBook }: { dashboard: { pendingReservations: number; approvedFutureReservations: number; completedReservations: number; activeStations: number } | null; role: Role; fullName: string; stations: Station[]; pendingUsers: number; setPage: (page: Page) => void; reservations: Reservation[]; onQr: () => void; onBook: () => void }) {
  const isProsumer = role === 'Prosumer'
  const count = (status: string) => reservations.filter((item) => item.status === status).length
  return <>
    <section className="page-intro"><div><p className="eyebrow">{new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p><h1>{fullName ? `Welcome, ${fullName}.` : 'Welcome.'}</h1><p className="muted">{isProsumer ? 'Your reservations and available stations.' : 'Your station and reservation overview.'}</p></div><button className="primary-button" onClick={() => isProsumer ? onBook() : setPage('stations')}><Zap size={16} />{isProsumer ? 'Book a slot' : 'View stations'}</button></section>
    <section className="metric-grid">
      <Metric icon={CalendarDays} label={isProsumer ? 'Your bookings' : 'Reservations'} value={reservations.length} accent="mint" />
      <Metric icon={Activity} label="Pending reservations" value={dashboard?.pendingReservations ?? count('Pending')} accent="sun" />
      <Metric icon={Check} label="Completed reservations" value={dashboard?.completedReservations ?? count('Completed')} accent="blue" />
      <Metric icon={MapPin} label="Active stations" value={dashboard?.activeStations ?? stations.filter((station) => station.status === 'Active').length} accent="coral" />
    </section>
    <section className="dashboard-grid">
      <div className="panel timeline-panel"><div className="panel-heading d-flex justify-content-between align-items-center"><div><p className="eyebrow">RESERVATIONS</p><h2>Recent bookings</h2></div><button className="quiet-button" onClick={() => setPage('reservations')}>View all <ArrowUpRight size={14} /></button></div>
        <div className="timeline">{reservations.length === 0 && <p className="muted">No reservations yet.</p>}{reservations.slice(0, 3).map((item, index) => <div className="timeline-item" key={item.id}><div className={`timeline-dot dot-${index}`} /><div><strong>{item.name}</strong><p>ID {shortReservationId(item.id)} / {item.person} / {item.time}</p></div><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span></div>)}</div>
        <div className="panel-footer"><span>{dashboard?.approvedFutureReservations ?? countApprovedFuture(reservations)} approved future reservations</span>{isProsumer && <button className="circle-action" onClick={onQr} title="View reservations to generate a QR code"><ScanLine size={17} /></button>}</div>
      </div>
      <div className="panel station-strip"><div className="panel-heading d-flex justify-content-between align-items-center"><div><p className="eyebrow">STATIONS</p><h2>Stations at a glance</h2></div><button className="quiet-button" onClick={() => setPage('stations')}>View all <ArrowUpRight size={14} /></button></div>
        {stations.length === 0 && <p className="muted">No stations available.</p>}{stations.slice(0, 3).map((station) => <div className="task" key={station.id}><div className="task-icon"><MapPin size={17} /></div><div><strong>{station.name}</strong><p>{station.area || 'Address unavailable'} / {station.status}</p></div></div>)}
      </div>
    </section>
    <section className="lower-grid"><div className="panel task-panel"><div className="panel-heading d-flex justify-content-between align-items-center"><h2>Energy telemetry</h2><BatteryCharging size={20} /></div><p className="muted">Energy output, battery charge and station load data are not available.</p></div>
      {role === 'Backoffice' && <div className="panel task-panel"><div className="panel-heading d-flex justify-content-between align-items-center"><h2>Prosumer activation</h2><Users size={20} /></div><p className="muted">{pendingUsers} accounts waiting for activation.</p><button className="quiet-button" onClick={() => setPage('people')}>Review accounts <ArrowUpRight size={14} /></button></div>}
    </section>
  </>
}
function Metric({ icon: Icon, label, value, accent }: { icon: typeof Activity; label: string; value: number; accent: string }) { return <div className={`metric-card ${accent}`}><div className="metric-top"><span className="metric-icon"><Icon size={17} /></span></div><p>{label}</p><strong>{value}</strong></div> }
function Stations({ stations, role, token, onAdd, onChanged }: { stations: Station[]; role: Role; token: string; onAdd: () => void; onChanged: () => void }) {
  const [query, setQuery] = useState('')
  const [manageId, setManageId] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState('')
  const canManage = role === 'Backoffice'
  const visible = stations.filter((station) => `${station.name} ${station.area}`.toLowerCase().includes(query.toLowerCase()))
  const toggle = async (station: Station) => {
    if (!station.id) return
    setWorking(station.id)
    try {
      const inactive = String(station.status).toLowerCase() === 'inactive'
      await apiRequest(`/api/stations/${station.id}/${inactive ? 'activate' : 'deactivate'}`, token, { method: 'POST' })
      onChanged()
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update station.') }
    finally { setWorking('') }
  }

 return <>
    <section className="page-intro">
      <div>
        <p className="eyebrow">FIELD NETWORK</p>
        <h1>Solar stations</h1>
        <p className="muted">{canManage ? 'Add nodes, set operating hours and keep the network live.' : 'A living view of every node in your clean energy network.'}</p>
      </div>
      {canManage && <button className="primary-button" onClick={onAdd}><MapPin size={16} /> Add station</button>}
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {manageId && <StationManagement stationId={manageId} token={token} role={role} onClose={() => setManageId('')} onChanged={onChanged} />}
    <div className="station-toolbar">
      <div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stations…" /></div>
      <button className="filter-button">{visible.length} stations <ChevronRight size={15} /></button>
    </div>
    <div className="station-grid">{visible.length === 0 && <p className="muted">{query ? 'No stations match your search.' : 'No stations available.'}</p>}{visible.map((station) => <article className="station-card" key={station.id ?? station.name}>
      <div className="station-card-top"><span className={`station-status ${String(station.status).toLowerCase()}`}><i /> {station.status}</span>{canManage && station.id ? <button className="text-button" disabled={working === station.id} onClick={() => toggle(station)}>{String(station.status).toLowerCase() === 'inactive' ? 'Activate' : 'Deactivate'}</button> : <button className="icon-button"><ArrowUpRight size={16} /></button>}</div>
      <div className="station-sun"><SunMedium size={28} /></div>
      <h2>{station.name}</h2>
      <p><MapPin size={14} /> {station.area}</p>
      <div className="load-row"><span>Capacity</span><strong>{station.capacityKwh == null ? 'Unavailable' : `${station.capacityKwh} kWh`}</strong></div>
      {role !== 'Prosumer' && station.id && <button className="reservation-action action-edit" onClick={() => setManageId(station.id!)}>Manage station & slots</button>}
      <div className="station-card-foot"><span><Grid2X2 size={14} /> {station.slots}</span><span>{station.operatingHours || 'Hours TBA'}</span></div>
    </article>)}</div>
  </>
}
function Reservations({ reservations, role, token, onBook, onChanged, onApproved, onEdit }: { reservations: Reservation[]; role: Role; token: string; onQr: () => void; onBook: () => void; onChanged: () => void; onApproved: (value: string) => void; onEdit: (reservation: Reservation) => void }) {
  const [working, setWorking] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('All')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [qrToken, setQrToken] = useState('')
  const [summary, setSummary] = useState<Reservation | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const act = async (item: Reservation, action: string) => {
    if (working || (action === 'cancel' && !window.confirm('Cancel this reservation?'))) return
    setWorking(item.id); setError('')
    try {
      const result = await apiRequest(`/api/reservations/${item.id}/${action}`, token, { method: 'POST' })
      if (action === 'qr') {
        if (!result?.qrToken) throw new Error('No QR token was returned.')
        onApproved(result.qrToken)
      } else { onChanged() }
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to update reservation.') }
    finally { setWorking('') }
  }
  

function WebQrScanner({ onClose, onDetected }: { onClose: () => void; onDetected: (value: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let timer = 0; let scannerInstance: QrScanner | null = null
    const start = async () => {
      try {
        if (!video.current) return
        scannerInstance = new QrScanner(video.current, (result) => { onDetected(typeof result === 'string' ? result : result.data) }, { highlightScanRegion: true, returnDetailedScanResult: true })
        await scannerInstance.start(); timer = window.setTimeout(() => scannerInstance?.stop(), 120000)
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to access the camera.') }
  }; start(); return () => { window.clearTimeout(timer); scannerInstance?.destroy() }
  }, [onDetected])
  return <div className="modal-backdrop"><div className="qr-modal" role="dialog" aria-label="Scan reservation QR"><button className="modal-close" onClick={onClose}>×</button><p className="eyebrow">GRID OPERATOR SCANNER</p><h2>Scan transaction QR</h2>{error ? <p className="form-error">{error}</p> : <video ref={video} className="qr-camera" playsInline muted /> }<button className="secondary-button wide" onClick={onClose}>Close scanner</button></div></div>
}
function BookingModal({ stations, token, onClose, onCreated, reservation, role = 'Prosumer' }: { role?: Role; reservation?: Reservation; stations: Station[]; token: string; onClose: () => void; onCreated: (message: string) => void }) {
  const [prosumers, setProsumers] = useState<Array<{ id: string; fullName: string; nic: string }>>([])
  const [prosumerId, setProsumerId] = useState('')
  const [prosumerError, setProsumerError] = useState('')
  const [prosumerRetry, setProsumerRetry] = useState(0)
  useEffect(() => {
    if (role === 'Prosumer' || reservation) return
    let cancelled = false
    apiRequest('/api/reservations/prosumers', token).then((data) => { if (!cancelled) setProsumers(data) }).catch((e) => { if (!cancelled) setProsumerError(e instanceof Error ? e.message : 'Unable to load prosumers.') })
    return () => { cancelled = true }
  }, [role, token, reservation, prosumerRetry])
  const activeStations = stations.filter((station) => (station.status === 'Active' || station.id === reservation?.stationId) && station.id)
  const [stationId, setStationId] = useState(reservation?.stationId ?? '')
  const [slots, setSlots] = useState<Slot[]>([])
  const [slotId, setSlotId] = useState(reservation?.slotId ?? '')
  const [loadingSlots, setLoadingSlots] = useState(!!reservation?.stationId)
  const [transactionType, setTransactionType] = useState(reservation?.transactionType ?? 'DropOff')
  const [energyKwh, setEnergyKwh] = useState(reservation?.amount.replace(' kWh', '') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [slotError, setSlotError] = useState('')
  const [retryVersion, setRetryVersion] = useState(0)
  useEffect(() => {
    if (!stationId) return
    let cancelled = false
    apiRequest(`/api/stations/slots?stationId=${encodeURIComponent(stationId)}&availableOnly=${reservation ? 'false' : 'true'}`, token)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Unable to load slots.')
        if (!cancelled) setSlots(data.filter((slot: Slot) => slot.stationId === stationId && (slot.id === reservation?.slotId || (slot.status === 'Available' && slot.reservedCapacity < slot.totalCapacity && new Date(slot.startUtc).getTime() > Date.now()))))
      })
      .catch((error) => { if (!cancelled) setSlotError(error instanceof Error ? error.message : 'Unable to load slots.') })
      .finally(() => { if (!cancelled) setLoadingSlots(false) })
    return () => { cancelled = true }
  }, [stationId, token, retryVersion, reservation])