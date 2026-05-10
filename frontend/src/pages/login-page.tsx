import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Dumbbell } from "lucide-react";
import { postLoginPath } from "../lib/navigation";
import { useAuth } from "../state/auth-context";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | undefined)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const signedIn = await login(email, password);
      queueMicrotask(() => {
        navigate(postLoginPath(signedIn.role, from), { replace: true });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page auth-page--vaultfit">
      <div className="auth-vaultfit-stack">
        <div className="auth-vaultfit-brand" aria-hidden>
          <Dumbbell className="auth-vaultfit-logo-icon" size={36} strokeWidth={2} />
          <span className="auth-vaultfit-wordmark">
            <span className="auth-vaultfit-wordmark-vault">Vault</span>
            <span className="auth-vaultfit-wordmark-fit">Fit</span>
          </span>
        </div>
        <form className="auth-vaultfit-form" onSubmit={onSubmit}>
          <h1 className="auth-vaultfit-title">Log in</h1>

          <label className="auth-vaultfit-label" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            className="auth-vaultfit-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            required
          />

          <label className="auth-vaultfit-label" htmlFor="login-password">
            Password
          </label>
          <input
            id="login-password"
            className="auth-vaultfit-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <button className="auth-vaultfit-submit" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Log in"}
          </button>
          {error ? <p className="error auth-vaultfit-error">{error}</p> : null}
          <p className="auth-vaultfit-footer">
            Not a member yet?{" "}
            <Link className="auth-vaultfit-footer-link" to="/register">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
