import { useState } from "react";
import type { FormEvent } from "react";
import { Activity, X } from "lucide-react";
import "./App.css";
import type { Page, Reservation } from "./types/domain";
import { useAuth } from "./hooks/useAuth";
import { useWorkspaceData } from "./hooks/useWorkspaceData";
import { AppLayout } from "./layouts/AppLayout";
import { LoginScreen } from "./pages/LoginPage";
import { Overview } from "./pages/OverviewPage";
import { Stations } from "./pages/StationsPage";
import { Reservations } from "./pages/ReservationsPage";
import { AccountSettings } from "./pages/SettingsPage";
import { PeopleManagement } from "./pages/PeoplePage";
import { ProsumerRegistrationModal } from "./components/auth/ProsumerRegistrationModal";
import { BookingModal } from "./components/reservations/BookingModal";
import { ReservationEditorModal } from "./components/reservations/ReservationEditorModal";
import { QrModal } from "./components/qr/QrModal";
import { StationModal } from "./components/stations/StationModal";

function App() {
  const { role, token, loggedIn, fullName, login, logout } = useAuth();
  const [page, setPage] = useState<Page>("overview");
  const [showRegistration, setShowRegistration] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showStationForm, setShowStationForm] = useState(false);
  const [editingReservation, setEditingReservation] =
    useState<Reservation | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const {
    stations,
    reservations,
    dataState,
    pendingUsers,
    dashboard,
    reload,
    reset,
  } = useWorkspaceData(loggedIn, token, role, setNotice);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await login(email, password);
      reset();
      setPage("overview");
      setShowQr(false);
      setQrValue("");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const signOut = () => {
    logout();
    setPassword("");
    reset();
    setMobileNav(false);
    setPage("overview");
    setShowQr(false);
    setQrValue("");
    setShowBooking(false);
    setShowStationForm(false);
    setEditingReservation(null);
    setNotice("");
  };
  if (!loggedIn)
    return (
      <>
        <LoginScreen
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          onSubmit={signIn}
          busy={busy}
          notice={notice}
          onRegister={() => setShowRegistration(true)}
        />
        {showRegistration && (
          <ProsumerRegistrationModal
            onClose={() => setShowRegistration(false)}
            onRegistered={(registeredEmail) => {
              setShowRegistration(false);
              setEmail(registeredEmail);
              setPassword("");
              setNotice(
                "Registration successful. Your account is pending Backoffice activation. You can sign in after it is activated.",
              );
            }}
          />
        )}
      </>
    );
  const openQr = (value: string) => {
    setQrValue(value);
    setShowQr(true);
  };
  return (
    <>
      <AppLayout
        role={role}
        page={page}
        setPage={setPage}
        mobileNav={mobileNav}
        setMobileNav={setMobileNav}
        fullName={fullName}
        dataState={dataState}
        overlays={
          <>
            {showQr && (
              <QrModal value={qrValue} onClose={() => setShowQr(false)} />
            )}
            {showBooking && (
              <BookingModal
                role={role}
                stations={stations}
                token={token}
                onClose={() => setShowBooking(false)}
                onCreated={(message) => {
                  setShowBooking(false);
                  setNotice(message);
                  reload();
                }}
              />
            )}
            {editingReservation && (
              <ReservationEditorModal
                role={role}
                stations={stations}
                token={token}
                reservation={editingReservation}
                onClose={() => setEditingReservation(null)}
                onSaved={() => {
                  setEditingReservation(null);
                  setNotice(
                    "Reservation updated. It is now waiting for approval; any previous QR code is no longer valid.",
                  );
                  reload();
                }}
              />
            )}
            {showStationForm && (
              <StationModal
                token={token}
                onClose={() => setShowStationForm(false)}
                onSaved={(message) => {
                  setShowStationForm(false);
                  setNotice(message);
                  reload();
                }}
              />
            )}
          </>
        }
        onSignOut={signOut}
        onHelp={() =>
          setNotice(
            "Bookings must be within 7 days. Changes and cancellations require 12 hours notice. Contact Backoffice for account activation or support.",
          )
        }
      >
        {notice && (
          <div className="notice">
            <Activity size={16} /> {notice}
            <button onClick={() => setNotice("")}>
              <X size={14} />
            </button>
          </div>
        )}
        {page !== "settings" && dataState === "loading" && (
          <p className="muted" role="status">
            Loading workspace data...
          </p>
        )}
        {page !== "settings" && dataState === "error" && (
          <button className="primary-button" onClick={reload}>
            Retry loading data
          </button>
        )}
        {dataState === "ready" && page === "overview" && (
          <Overview
            dashboard={dashboard}
            stations={stations}
            fullName={fullName}
            pendingUsers={pendingUsers}
            role={role}
            setPage={setPage}
            reservations={reservations}
            onQr={() => setPage("reservations")}
            onBook={() => setShowBooking(true)}
          />
        )}
        {dataState === "ready" && page === "stations" && (
          <Stations
            stations={stations}
            role={role}
            token={token}
            onAdd={() => setShowStationForm(true)}
            onChanged={reload}
          />
        )}
        {dataState === "ready" && page === "reservations" && (
          <Reservations
            reservations={reservations}
            role={role}
            token={token}
            onQr={() =>
              setNotice(
                "Use the Grid Operator scanning client to scan and complete a reservation.",
              )
            }
            onBook={() => setShowBooking(true)}
            onChanged={reload}
            onApproved={(value) => openQr(value)}
            onEdit={(reservation) => setEditingReservation(reservation)}
          />
        )}
        {page === "settings" && <AccountSettings token={token} />}
        {dataState === "ready" && page === "people" && (
          <PeopleManagement token={token} onChanged={reload} />
        )}
      </AppLayout>
    </>
  );
}
export default App;
