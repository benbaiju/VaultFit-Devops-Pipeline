import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { VaultFitLogo } from "../components/vaultfit-logo";
import { postLoginPath } from "../lib/navigation";
import { useAuth } from "../state/auth-context";

type SignupRole = "client" | "trainer" | "nutritionist";

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
    <main className="auth-page auth-page--vaultfit">
      <div className="auth-vaultfit-stack">
        <div className="auth-vaultfit-brand">
          <VaultFitLogo size="lg" />
        </div>
        <form className="auth-vaultfit-form" onSubmit={onSubmit}>
          <h1 className="auth-vaultfit-title">Create an account</h1>

          <label className="auth-vaultfit-label" htmlFor="reg-name">
            Name
          </label>
          <input
            id="reg-name"
            className="auth-vaultfit-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="What should we call you?"
            autoComplete="name"
            required
          />

          <label className="auth-vaultfit-label" htmlFor="reg-role">
            Join as
          </label>
          <select
            id="reg-role"
            className="auth-vaultfit-input auth-vaultfit-select"
            value={role}
            onChange={(e) => setRole(e.target.value as SignupRole)}
          >
            <option value="client">Client</option>
            <option value="trainer">Trainer</option>
            <option value="nutritionist">Nutritionist</option>
          </select>

          <label className="auth-vaultfit-label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            className="auth-vaultfit-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            autoComplete="email"
            required
          />

          <label className="auth-vaultfit-label" htmlFor="reg-password">
            Password
          </label>
          <input
            id="reg-password"
            className="auth-vaultfit-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            minLength={8}
            autoComplete="new-password"
            required
          />
          <p className="auth-vaultfit-hint">Must be at least 8 characters</p>

          <button className="auth-vaultfit-submit" type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </button>
          {error ? <p className="error auth-vaultfit-error">{error}</p> : null}
          <p className="auth-vaultfit-footer">
            Already a member?{" "}
            <Link className="auth-vaultfit-footer-link" to="/login">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
