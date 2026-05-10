import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, LogOut, Shield, Trash2 } from "lucide-react";
import { changePassword } from "../services/auth";
import { getMyProfile, updateMyProfile, type UpdateProfileInput } from "../services/profiles";
import { useAuth } from "../state/auth-context";

const TIMEZONES = [
  { value: "", label: "Use browser default" },
  { value: "Australia/Melbourne", label: "Australia / Melbourne" },
  { value: "Australia/Sydney", label: "Australia / Sydney" },
  { value: "Australia/Brisbane", label: "Australia / Brisbane" },
  { value: "Australia/Perth", label: "Australia / Perth" },
  { value: "Pacific/Auckland", label: "Pacific / Auckland" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America / New York" },
  { value: "America/Los_Angeles", label: "America / Los Angeles" },
  { value: "Europe/London", label: "Europe / London" },
];

export function AdminSettingsPage() {
  const { token, user, logout, refreshUserDisplay } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
    enabled: user?.role === "admin",
  });

  const timezoneOptions = useMemo(() => {
    const current = profileQuery.data?.timezone;
    if (current && !TIMEZONES.some((o) => o.value === current)) {
      return [...TIMEZONES, { value: current, label: current }];
    }
    return TIMEZONES;
  }, [profileQuery.data?.timezone]);

  useEffect(() => {
    const p = profileQuery.data;
    if (!p) return;
    setFullName(p.full_name ?? "");
    setPhone(p.phone ?? "");
    setTimezone(p.timezone ?? "");
    setAvatarUrl(p.avatar_url ?? "");
  }, [profileQuery.data]);

  async function handleAvatarFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setSaveMessage("");
    if (!file.type.startsWith("image/")) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image must be 8MB or smaller.");
      return;
    }
    setError("");
    try {
      const dataUrl = await compressImageToJpegDataUrl(file, 512, 0.88);
      if (dataUrl.length > 1_400_000) {
        setError("Processed image is still too large; try a smaller photo.");
        return;
      }
      setAvatarUrl(dataUrl);
    } catch (e) {
      setError((e as Error).message || "Could not read that image.");
    }
    if (avatarFileRef.current) avatarFileRef.current.value = "";
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const input: UpdateProfileInput = {
        phone: phone.trim(),
        timezone: timezone.trim(),
        avatarUrl: avatarUrl.trim(),
      };
      if (fullName.trim().length >= 2) input.fullName = fullName.trim();
      return updateMyProfile(token, input);
    },
    onSuccess: (profile) => {
      setError("");
      setSaveMessage("Profile saved.");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      refreshUserDisplay({
        full_name: profile.full_name ?? undefined,
      });
    },
    onError: (e) => {
      setSaveMessage("");
      setError((e as Error).message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => changePassword(token, { currentPassword, newPassword }),
    onSuccess: () => {
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      logout();
    },
    onError: (e) => setPasswordError((e as Error).message),
  });

  if (user?.role !== "admin") {
    return (
      <section className="admin-surface-section admin-settings">
        <h1 className="admin-page-title">Profile Settings</h1>
        <p className="error">Admin access required.</p>
      </section>
    );
  }

  const email = profileQuery.data?.email ?? user.email;
  const phoneVerified = profileQuery.data?.phone_verified === true;

  return (
    <section className="admin-surface-section admin-settings">
      <header className="admin-settings-header">
        <h1 className="admin-page-title">Profile Settings</h1>
        <p className="muted admin-page-lead">
          Update how you appear in the admin console and keep your contact details current.
        </p>
      </header>

      {profileQuery.isLoading ? <p className="admin-muted-text">Loading profile…</p> : null}
      {profileQuery.isError ? <p className="error">{(profileQuery.error as Error).message}</p> : null}

      {error ? <p className="error admin-settings-banner">{error}</p> : null}
      {saveMessage ? <p className="admin-settings-success">{saveMessage}</p> : null}

      <div className="admin-settings-grid">
        <article className="admin-settings-card">
          <h2 className="admin-settings-card-title">Profile</h2>
          <p className="admin-settings-card-desc">Display name, contact, and photo URL used across VaultFit.</p>

          <label className="admin-settings-label" htmlFor="admin-settings-name">
            Display name
          </label>
          <input
            id="admin-settings-name"
            className="admin-settings-input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Admin name"
            autoComplete="name"
          />

          <label className="admin-settings-label" htmlFor="admin-settings-email">
            Email
          </label>
          <input id="admin-settings-email" className="admin-settings-input" value={email} disabled readOnly />
          <p className="admin-settings-hint">Email is tied to your login and cannot be changed here.</p>

          <label className="admin-settings-label" htmlFor="admin-settings-phone">
            Phone
          </label>
          <input
            id="admin-settings-phone"
            className="admin-settings-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Optional"
            autoComplete="tel"
          />
          {phone ? (
            <p className="admin-settings-hint">
              {phoneVerified ? "Verified" : "Not verified — use the client or trainer profile flow to verify with OTP."}
            </p>
          ) : null}

          <label className="admin-settings-label" htmlFor="admin-settings-tz">
            Timezone
          </label>
          <select
            id="admin-settings-tz"
            className="admin-settings-input admin-settings-select"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {timezoneOptions.map((tz) => (
              <option key={tz.value || "default"} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>

          <label className="admin-settings-label">Profile photo</label>
          <div className="admin-settings-avatar-row">
            <div className="admin-settings-avatar-preview" aria-hidden>
              {avatarUrl.trim() ? (
                <img src={avatarUrl.trim()} alt="" className="admin-settings-avatar-img" />
              ) : (
                <span className="admin-settings-avatar-fallback">
                  {(fullName.trim() || email).slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <div className="admin-settings-avatar-actions">
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="admin-settings-file-input"
                onChange={(e) => void handleAvatarFile(e.target.files)}
              />
              <button type="button" className="admin-settings-btn admin-settings-btn--secondary" onClick={() => avatarFileRef.current?.click()}>
                <ImagePlus size={16} aria-hidden />
                Upload image
              </button>
              {avatarUrl.trim() ? (
                <button
                  type="button"
                  className="admin-settings-btn admin-settings-btn--ghost"
                  onClick={() => {
                    setAvatarUrl("");
                    setSaveMessage("");
                    setError("");
                  }}
                >
                  <Trash2 size={16} aria-hidden />
                  Remove
                </button>
              ) : null}
            </div>
          </div>
          <label className="admin-settings-label" htmlFor="admin-settings-avatar">
            Or paste image URL
          </label>
          <input
            id="admin-settings-avatar"
            className="admin-settings-input"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://… or leave blank after upload"
          />
          <p className="admin-settings-hint">
            Upload resizes to a JPEG preview (same pattern as client profiles). You can also paste a public https URL.
            Save changes to apply.
          </p>

          <div className="admin-settings-actions">
            <button
              type="button"
              className="admin-settings-btn admin-settings-btn--primary"
              disabled={saveMutation.isPending || profileQuery.isLoading}
              onClick={() => {
                setSaveMessage("");
                saveMutation.mutate();
              }}
            >
              {saveMutation.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </article>

        <article className="admin-settings-card">
          <h2 className="admin-settings-card-title">Account</h2>
          <p className="admin-settings-card-desc">Read-only summary of your administrator account.</p>

          <dl className="admin-settings-dl">
            <div>
              <dt>Role</dt>
              <dd>
                <span className="admin-settings-badge">
                  <Shield size={14} aria-hidden /> Administrator
                </span>
              </dd>
            </div>
            <div>
              <dt>User ID</dt>
              <dd className="admin-settings-mono">{user.id}</dd>
            </div>
          </dl>
          <p className="admin-settings-hint">This account can manage users, verifications, and support tickets.</p>
        </article>

        <article className="admin-settings-card">
          <h2 className="admin-settings-card-title">Security</h2>
          <p className="admin-settings-card-desc">Change the password you use to sign in to VaultFit.</p>

          {passwordError ? <p className="error admin-settings-banner">{passwordError}</p> : null}

          <label className="admin-settings-label" htmlFor="admin-settings-current-pw">
            Current password
          </label>
          <input
            id="admin-settings-current-pw"
            className="admin-settings-input"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <label className="admin-settings-label" htmlFor="admin-settings-new-pw">
            New password
          </label>
          <input
            id="admin-settings-new-pw"
            className="admin-settings-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="admin-settings-hint">At least 8 characters.</p>

          <label className="admin-settings-label" htmlFor="admin-settings-confirm-pw">
            Confirm new password
          </label>
          <input
            id="admin-settings-confirm-pw"
            className="admin-settings-input"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div className="admin-settings-actions">
            <button
              type="button"
              className="admin-settings-btn admin-settings-btn--primary"
              disabled={
                passwordMutation.isPending ||
                !currentPassword ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              onClick={() => {
                setPasswordError("");
                if (newPassword !== confirmPassword) {
                  setPasswordError("New password and confirmation do not match.");
                  return;
                }
                passwordMutation.mutate();
              }}
            >
              {passwordMutation.isPending ? "Updating…" : "Update password"}
            </button>
          </div>
          <p className="admin-settings-hint" style={{ marginTop: "0.75rem" }}>
            After a successful change you will be signed out and can log in with the new password. Forgot your current
            password? Use the reset link on the login page instead.
          </p>
          <p className="admin-settings-hint">Two-factor authentication is not available in this MVP build.</p>
        </article>
      </div>

      <div className="admin-settings-signout-wrap">
        <button type="button" className="admin-settings-btn admin-settings-btn--danger" onClick={logout}>
          <LogOut size={18} aria-hidden />
          Sign out
        </button>
      </div>
    </section>
  );
}

function compressImageToJpegDataUrl(file: File, maxEdge: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result;
      if (typeof src !== "string") {
        reject(new Error("Could not read file."));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not process image."));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Invalid image file."));
      img.src = src;
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}
