import { useAuth } from "../state/auth-context";

export function AdminSettingsPage() {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return (
      <section className="admin-surface-section">
        <h2 className="admin-page-title">Profile settings</h2>
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  return (
    <section className="admin-surface-section">
      <h2 className="admin-page-title">Profile settings</h2>
      <p className="muted admin-page-lead">Account preferences for administrators will appear here.</p>
      <div className="admin-card admin-card--flat">
        <p className="admin-muted-text" style={{ margin: 0 }}>
          Signed in as <strong className="admin-text-primary">{user.email}</strong>
        </p>
      </div>
    </section>
  );
}
