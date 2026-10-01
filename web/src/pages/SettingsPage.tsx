import { useState } from "react";
import { useEffect } from "react";
import { apiRequest } from "../api";
import type { FormEvent } from "react";
import { ShieldCheck } from "lucide-react";

export function AccountSettings({ token }: { token: string }) {
  const [account, setAccount] = useState<{
    fullName: string;
    email: string;
  } | null>(null);
  const [accountError, setAccountError] = useState("");
  const [retry, setRetry] = useState(0);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/auth/account", token)
      .then((data) => {
        if (
          !data ||
          typeof data.fullName !== "string" ||
          typeof data.email !== "string"
        )
          throw new Error("Unable to load account.");
        if (!cancelled) setAccount(data);
      })
      .catch((error) => {
        if (!cancelled)
          setAccountError(
            error instanceof Error ? error.message : "Unable to load account.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [token, retry]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    setSuccess("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("Choose a different new password.");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/api/auth/change-password", token, {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(
        "Password changed successfully. Use your new password next time you sign in.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to change password.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h1>Settings</h1>
          <p className="muted">View your account and change your password.</p>
        </div>
      </section>
      <section className="panel" style={{ maxWidth: 520 }}>
        {account ? (
          <div className="booking-form">
            <label>
              Name
              <input readOnly value={account.fullName} />
            </label>
            <label>
              Email
              <input readOnly value={account.email} />
            </label>
          </div>
        ) : accountError ? (
          <div role="alert">
            <p className="form-error">{accountError}</p>
            <button
              className="text-button"
              onClick={() => {
                setAccountError("");
                setRetry((value) => value + 1);
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <p role="status">Loading account...</p>
        )}
        <form className="booking-form" onSubmit={submit}>
          <h2>Change password</h2>
          <label>
            Current password
            <input
              required
              disabled={busy}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              required
              disabled={busy}
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <span className="muted">At least 8 characters.</span>
          </label>
          <label>
            Confirm new password
            <input
              required
              disabled={busy}
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="notice" role="status">
              {success}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "Saving..." : "Change password"}
            <ShieldCheck size={16} />
          </button>
        </form>
      </section>
    </>
  );
}
