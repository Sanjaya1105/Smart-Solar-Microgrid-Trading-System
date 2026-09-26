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
  const complete = async (e: FormEvent) => {
    e.preventDefault(); if (working) return; setWorking('scan'); setError('')
    try { await apiRequest('/api/reservations/complete-by-qr', token, { method: 'POST', body: JSON.stringify({ qrToken: qrToken.trim() }) }); setQrToken(''); onChanged() }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to complete reservation.') } finally { setWorking('') }
  }
  const visible = filterReservations(reservations, { status, query, from, to })
  return <><section className="page-intro"><div><p className="eyebrow">ENERGY MOVEMENT</p><h1>{role === 'Prosumer' ? 'Your reservations' : 'Reservations'}</h1><p className="muted">Manage bookings and review scheduled transfers.</p></div><button className="primary-button" onClick={onBook}><Plus size={16} /> New reservation</button></section>
    <div className="filter-tabs">{['All', 'Current', 'Pending', 'Approved', 'Completed', 'History'].map((value) => <button key={value} className={status === value ? 'selected' : ''} onClick={() => setStatus(value)}>{value}</button>)}</div>
    <div className="management-filters d-flex flex-wrap gap-3"><label>Search<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Reservation ID, name, NIC or station" /></label><label>Slot date from<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label>Slot date to<input type="date" min={from || undefined} value={to} onChange={(e) => setTo(e.target.value)} /></label><button className="text-button" onClick={() => { setQuery(''); setStatus('All'); setFrom(''); setTo('') }}>Clear filters</button></div>
    {from && to && from > to && <p className="form-error">End date must be on or after start date.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {scannerOpen && <WebQrScanner onClose={() => setScannerOpen(false)} onDetected={(value) => { setQrToken(value); setScannerOpen(false) }} />}
    <p className="muted">{visible.length} matching reservations. Times are shown in your local timezone.</p>
    <div className="panel table-panel"><div className="table-head"><span>Reservation</span><span>Station</span><span>Scheduled time</span><span>Energy</span><span>Status</span><span>Actions</span></div>
      {!visible.length && <p className="empty-state">No matching reservations.</p>}{visible.map((item) => <div className="table-row" key={item.id}><div><button className="text-button reservation-title" onClick={() => setSummary(item)}>{item.name}</button><small>ID {shortReservationId(item.id)} ? {item.person}</small></div><span>{item.station}</span><span>{item.time}</span><span>{item.amount}</span><span className={`status ${item.status.toLowerCase()}`}>{item.status}</span><div className="row-actions reservation-actions" aria-busy={working === item.id}>
        {role === 'Backoffice' && item.status === 'Pending' && <><button className="reservation-action action-approve" disabled={!!working} onClick={() => act(item, 'decision?approve=true')}>Approve</button><button className="reservation-action action-reject" disabled={!!working} onClick={() => act(item, 'decision?approve=false')}>Reject</button></>}
        {role === 'Prosumer' && item.status === 'Approved' && <button className="reservation-action action-qr" disabled={!!working} onClick={() => act(item, 'qr')}><QrCode size={15} /> Get QR</button>}
        {role === 'GridOperator' && item.status === 'Approved' && <><button className="reservation-action action-qr" disabled={!!working} onClick={() => setScannerOpen(true)}><ScanLine size={15} /> Scan QR</button><button className="reservation-action action-approve" disabled={!qrToken.trim() || !!working} onClick={() => { if (qrToken.trim()) void complete(new Event('submit') as unknown as FormEvent) }}>Complete</button></>}
        {role !== 'GridOperator' && ['Pending', 'Approved'].includes(item.status) && <><button className="reservation-action action-edit" disabled={!!working} onClick={() => onEdit(item)}><Pencil size={15} /> Edit</button><button className="reservation-action action-cancel" disabled={!!working} onClick={() => act(item, 'cancel')}><Ban size={15} /> Cancel</button></>}
        {working === item.id && <span className="reservation-working" role="status"><LoaderCircle size={14} /> Working...</span>}
      </div></div>)}
    </div>
    {summary && <div className="modal-backdrop"><div className="form-modal" role="dialog" aria-modal="true" aria-label="Reservation summary"><button className="modal-close" aria-label="Close summary" onClick={() => setSummary(null)}><X size={18} /></button><h2>Reservation summary</h2><dl><dt>ID</dt><dd>{summary.id}</dd><dt>Station</dt><dd>{summary.station}</dd><dt>Scheduled time</dt><dd>{summary.time}</dd><dt>Transaction</dt><dd>{summary.transactionType}</dd><dt>Energy</dt><dd>{summary.amount}</dd><dt>Status</dt><dd>{summary.status}</dd></dl></div></div>}
  </>
}
private void loadStations() { run(() -> { JSONArray stations = ApiClient.list("/api/stations?activeOnly=true", store.token()); runOnUiThread(() -> { clearDynamicRows(4); for (int i=0;i<stations.length();i++) { JSONObject station=stations.optJSONObject(i); TextView item=new TextView(this); item.setPadding(0,dp(16),0,dp(16)); double lat=station.optDouble("latitude"), lon=station.optDouble("longitude"); item.setText(station.optString("name")+"\n"+station.optString("address")+"\nGPS "+lat+", "+lon+"\nCapacity "+station.optDouble("capacityKwh")+" kWh\nTap to open in Google Maps"); item.setOnClickListener(v->{ try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse("geo:"+lat+","+lon+"?q="+lat+","+lon+"("+Uri.encode(station.optString("name") )+")"))); } catch(Exception e) { message.setText("Google Maps is not available on this device."); } }); root.addView(item); } }); }); }
    private void showReservations() { base("My reservations"); root.addView(button("Refresh", v -> loadReservations())); root.addView(button("Back", v -> showDashboard())); loadReservations(); }
    private void loadReservations() { run(() -> { JSONArray reservations=ApiClient.list("/api/reservations/mine",store.token()); runOnUiThread(() -> { clearDynamicRows(4); for(int i=0;i<reservations.length();i++){ JSONObject item=reservations.optJSONObject(i); LinearLayout card=new LinearLayout(this); card.setOrientation(LinearLayout.VERTICAL); TextView row=new TextView(this); row.setPadding(0,15,0,8); row.setText("Status: "+item.optString("status")+"\nEnergy: "+item.optDouble("energyKwh")+" kWh\nReservation: "+item.optString("id")); card.addView(row); String status=item.optString("status"); if("Approved".equals(status)) card.addView(button("Show secure QR", v -> showQr(item.optString("id")))); if(!"Completed".equals(status) && !"Cancelled".equals(status) && !"Rejected".equals(status)) { card.addView(button("Edit reservation", v -> showEditReservation(item))); card.addView(button("Cancel reservation", v -> cancelReservation(item.optString("id")))); } root.addView(card); } }); }); }