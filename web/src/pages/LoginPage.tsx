import type { FormEvent } from "react";
import { SunMedium } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { ShieldCheck } from "lucide-react";

export function LoginScreen({
  email,
  password,
  setEmail,
  setPassword,
  onSubmit,
  busy,
  notice,
  onRegister,
}: {
  onRegister: () => void;
  email: string;
  password: string;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  busy: boolean;
  notice: string;
}) {
  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="login-art-content">
          <div className="brand light">
            <span className="brand-mark">
              <SunMedium size={20} />
            </span>
            <span>
              solar<span>grid</span>
            </span>
          </div>
          <div className="art-copy">
            <p className="eyebrow">SMART ENERGY OPERATIONS</p>
            <h1>
              Make every
              <br />
              <em>ray</em> count.
            </h1>
            <p>
              One calm command centre for stations, bookings, and the people
              powering tomorrow.
            </p>
            <div className="energy-line">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <small>Sign in to view your stations and reservations.</small>
          </div>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-box">
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Power the network.</h2>
          <p className="muted">Sign in to your Solargrid workspace.</p>
          <form onSubmit={onSubmit}>
            <label>
              Email or NIC
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <div className="form-row">
              <span className="muted">
                Forgot your password? Contact Backoffice for support.
              </span>
            </div>
            <button className="primary-button wide" disabled={busy}>
              {busy ? "Connecting…" : "Enter workspace"}{" "}
              <ArrowUpRight size={17} />
            </button>
          </form>
          {notice && <p className="login-notice">{notice}</p>}
          <div className="login-footer">
            <span>New to the network?</span>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={onRegister}
            >
              Register as a prosumer
            </button>
          </div>
        </div>
        <div className="login-meta">
          <span>© {new Date().getFullYear()} Solargrid</span>
          <span>
            <ShieldCheck size={14} /> Secure access
          </span>
        </div>
      </div>
    </div>
  );
}
