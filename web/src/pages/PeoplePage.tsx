import { useState } from "react";
import type { User } from "../types/management";
import { useEffect } from "react";
import { apiRequest } from "../api";
import { message } from "../utils/management";
import { UserEditor } from "../components/people/UserEditor";

export function PeopleManagement({
  token,
  onChanged,
}: {
  token: string;
  onChanged: () => void;
}) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("Prosumer");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<User | "staff" | "prosumer" | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    apiRequest("/api/users", token)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("Invalid user response.");
        if (!cancelled) setUsers(data);
      })
      .catch((e) => {
        if (!cancelled) setError(message(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, version]);
  const changeStatus = async (user: User, next: string) => {
    if (
      !window.confirm(
        `${next === "Inactive" ? "Deactivate" : "Activate"} ${user.fullName}?`,
      )
    )
      return;
    setWorking(true);
    setError("");
    try {
      await apiRequest(`/api/users/${user.id}/status`, token, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      onChanged();
    } catch (e) {
      setError(message(e));
    } finally {
      setWorking(false);
    }
  };
  const visible = users.filter(
    (user) =>
      (!role || user.role === role) &&
      (!status || user.status === status) &&
      `${user.fullName} ${user.nic} ${user.email}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <>
      <section className="page-intro">
        <div>
          <p className="eyebrow">ACCESS & TRUST</p>
          <h1>People & access</h1>
          <p className="muted">
            Manage profiles, pending activation and account status.
          </p>
        </div>
        <div className="row-actions d-flex flex-wrap gap-2 align-items-center">
          <button
            className="primary-button"
            onClick={() => setEditing("prosumer")}
          >
            Add prosumer
          </button>
          <button
            className="primary-button"
            onClick={() => setEditing("staff")}
          >
            Add staff
          </button>
        </div>
      </section>
      <div className="management-filters d-flex flex-wrap gap-3">
        <label>
          Search
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, NIC or email"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {["Prosumer", "Backoffice", "GridOperator"].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["Pending", "Active", "DeactivationRequested", "Inactive"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {error && (
        <div role="alert" className="form-error">
          {error}{" "}
          <button
            className="text-button"
            onClick={() => {
              setError("");
              setLoading(true);
              setVersion((v) => v + 1);
            }}
          >
            Retry
          </button>
        </div>
      )}
      <section className="panel">
        {loading ? (
          <p role="status">Loading accounts...</p>
        ) : (
          <>
            <p className="muted">
              {visible.length} accounts ·{" "}
              {
                users.filter(
                  (u) => u.role === "Prosumer" && u.status === "Pending",
                ).length
              }{" "}
              prosumers pending activation
            </p>
            {!visible.length && <p>No matching accounts.</p>}
            {visible.map((user) => (
              <div className="person-row" key={user.id}>
                <div>
                  <strong>{user.fullName}</strong>
                  <p>
                    {user.nic} · {user.email}
                  </p>
                  <p>
                    {user.role} · {user.phone} · {user.address}
                  </p>
                </div>
                <span className={`status ${user.status.toLowerCase()}`}>
                  {user.status}
                </span>
                <div className="row-actions d-flex flex-wrap gap-2 align-items-center">
                  <button
                    className="reservation-action action-edit"
                    disabled={working}
                    onClick={() => setEditing(user)}
                  >
                    Edit
                  </button>
                  {user.status !== "Active" && (
                    <button
                      className="reservation-action action-approve"
                      disabled={working}
                      onClick={() => changeStatus(user, "Active")}
                    >
                      {user.status === "Inactive" ? "Reactivate" : "Activate"}
                    </button>
                  )}
                  {user.status !== "Inactive" && (
                    <button
                      className="reservation-action action-cancel"
                      disabled={working}
                      onClick={() => changeStatus(user, "Inactive")}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </section>
      {editing && (
        <UserEditor
          key={typeof editing === "string" ? editing : editing.id}
          token={token}
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
    </>
  );
}
