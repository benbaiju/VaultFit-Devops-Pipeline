import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { postLoginPath } from "../lib/navigation";
import { useAuth } from "../state/auth-context";

type SignupRole = "client" | "trainer";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<SignupRole>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await register({ fullName, role, email, password });
      queueMicrotask(() => {
        navigate(postLoginPath(user.role), { replace: true });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <p className="brand-pill">Get started</p>
        <h2>Create account</h2>
        <p className="muted">Create your VaultFit account in under a minute.</p>
        <label>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
        <label>I am signing up as</label>
        <select value={role} onChange={(e) => setRole(e.target.value as SignupRole)}>
          <option value="client">Client — book sessions with trainers</option>
          <option value="trainer">Trainer — list services and take bookings</option>
        </select>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          minLength={8}
          required
        />
        <button className="primary-btn" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
        {error ? <p className="error">{error}</p> : null}
        <p className="muted">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
