import type { User } from "../../types/management";
import { useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../../api";
import { message } from "../../utils/management";
import { Dialog } from "../common/Dialog";

export function UserEditor({
  token,
  editing,
  onClose,
  onSaved,
}: {
  token: string;
  editing: User | "staff" | "prosumer";
  onClose: () => void;
  onSaved: () => void;
}) {
  const user = typeof editing === "string" ? null : editing;
  const [form, setForm] = useState({
    fullName: user?.fullName ?? "",
    nic: user?.nic ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    address: user?.address ?? "",
    password: "",
    role: "GridOperator",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = user
        ? {
            fullName: form.fullName,
            email: form.email,
            phone: form.phone,
            address: form.address,
          }
        : form;
      await apiRequest(
        user
          ? `/api/users/${user.id}`
          : `/api/users/${editing === "staff" ? "staff" : "prosumers"}`,
        token,
        { method: user ? "PUT" : "POST", body: JSON.stringify(body) },
      );
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      title={
        user
          ? "Edit profile"
          : editing === "staff"
            ? "Add staff"
            : "Add prosumer"
      }
      onClose={onClose}
      busy={busy}
    >
      <form className="booking-form" onSubmit={submit}>
        <label>
          NIC
          <input
            required
            readOnly={!!user}
            minLength={9}
            maxLength={12}
            value={form.nic}
            onChange={(e) => update("nic", e.target.value)}
          />
        </label>
        <label>
          Full name
          <input
            required
            maxLength={100}
            value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
          />
        </label>
        <label>
          Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </label>
        <label>
          Phone
          <input
            required
            type="tel"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
          />
        </label>
        <label>
          Address
          <input
            required
            maxLength={250}
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
          />
        </label>
        {!user && (
          <label>
            Initial password
            <input
              required
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
            />
          </label>
        )}
        {editing === "staff" && (
          <label>
            Role
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
            >
              <option value="GridOperator">Grid Operator</option>
              <option value="Backoffice">Backoffice</option>
            </select>
          </label>
        )}
        {editing === "prosumer" && (
          <p className="muted">
            The new account will be Pending. Activate it from the account list.
          </p>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Saving..." : "Save account"}
        </button>
      </form>
    </Dialog>
  );
}
