import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | undefined)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <p className="brand-pill">Welcome back</p>
        <h2>Sign in to VaultFit</h2>
        <p className="muted">Use your account to manage bookings and trainers.</p>
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
        <button className="primary-btn" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
        {error ? <p className="error">{error}</p> : null}
        <p className="muted">
          New here? <Link to="/register">Create account</Link>
        </p>
      </form>
    </main>
  );
}
