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