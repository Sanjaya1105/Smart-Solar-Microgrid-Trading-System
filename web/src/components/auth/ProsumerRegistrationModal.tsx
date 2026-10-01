import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../../api";
import { X } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export function ProsumerRegistrationModal({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (email: string) => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    nic: "",
    email: "",
    phone: "",
    address: "",
    password: "",
  });
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (form.password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    if (
      ![form.fullName, form.nic, form.email, form.phone, form.address].every(
        (value) => value.trim(),
      )
    ) {
      setError("Please complete all fields.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/api/auth/register-prosumer", "", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          fullName: form.fullName.trim(),
          nic: form.nic.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
        }),
      });
      onRegistered(form.email.trim());
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to register. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="form-modal station-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label="Close registration"
          disabled={busy}
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <p className="eyebrow">JOIN SOLARGRID</p>
        <h2 id="registration-title">Register as a prosumer</h2>
        <p className="muted">
          Create your account. Backoffice must activate it before you can sign
          in.
        </p>
        <form className="booking-form" onSubmit={submit}>
          <label>
            Full name
            <input
              autoFocus
              required
              maxLength={100}
              disabled={busy}
              autoComplete="name"
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
            />
          </label>
          <label>
            NIC
            <input
              required
              minLength={9}
              maxLength={12}
              disabled={busy}
              value={form.nic}
              onChange={(event) => update("nic", event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              required
              type="email"
              disabled={busy}
              autoComplete="email"
              value={form.email}
              onChange={(event) => update("email", event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              required
              type="tel"
              disabled={busy}
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
            />
          </label>
          <label>
            Address
            <input
              required
              maxLength={250}
              disabled={busy}
              autoComplete="street-address"
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              minLength={8}
              disabled={busy}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => update("password", event.target.value)}
            />
            <span className="muted">At least 8 characters.</span>
          </label>
          <label>
            Confirm password
            <input
              required
              type="password"
              minLength={8}
              disabled={busy}
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button wide" disabled={busy}>
            {busy ? "Registering..." : "Create account"}
            <ArrowUpRight size={16} />
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={onClose}
          >
            Back to sign in
          </button>
        </form>
      </div>
    </div>
  );
}
