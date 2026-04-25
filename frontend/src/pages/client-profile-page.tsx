import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getBookings } from "../services/bookings";
import { getTrainerReviews } from "../services/reviews";
import { getTrainers } from "../services/trainers";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../services/profiles";
import { useAuth } from "../state/auth-context";

function StarDisplay({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: "0.1rem", verticalAlign: "middle" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          fill={star <= value ? "currentColor" : "none"}
          style={{ color: star <= value ? "#f59e0b" : "#64748b" }}
        />
      ))}
    </span>
  );
}

export function ClientProfilePage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarEditorSrc, setAvatarEditorSrc] = useState<string | null>(null);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [avatarOffsetX, setAvatarOffsetX] = useState(0);
  const [avatarOffsetY, setAvatarOffsetY] = useState(0);
  const [isDraggingAvatar, setIsDraggingAvatar] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [error, setError] = useState("");
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const completedBookings = useMemo(
    () => (bookingsQuery.data ?? []).filter((booking) => booking.status === "completed"),
    [bookingsQuery.data],
  );
  const completedTrainerIds = useMemo(
    () =>
      Array.from(
        new Set(completedBookings.map((booking) => booking.trainer_id).filter((id): id is string => Boolean(id))),
      ),
    [completedBookings],
  );
  const reviewsByCompletedTrainer = useQueries({
    queries: completedTrainerIds.map((trainerId) => ({
      queryKey: ["reviews", trainerId],
      queryFn: () => getTrainerReviews(trainerId),
      enabled: Boolean(user?.id),
    })),
  });
  const trainerNameById = useMemo(() => {
    const map = new Map<string, string>();
    (trainersQuery.data ?? []).forEach((trainer) => {
      map.set(trainer.id, trainer.profiles?.full_name ?? "Trainer");
    });
    return map;
  }, [trainersQuery.data]);
  const myReviews = useMemo(() => {
    const rows: Array<{ id: string; bookingId: string; trainerName: string; rating: number; comment: string | null }> = [];
    reviewsByCompletedTrainer.forEach((query) => {
      (query.data ?? []).forEach((review) => {
        if (review.client_id !== user?.id) return;
        rows.push({
          id: review.id,
          bookingId: review.booking_id,
          trainerName: trainerNameById.get(review.trainer_id) ?? "Trainer",
          rating: review.rating,
          comment: review.comment,
        });
      });
    });
    return rows;
  }, [reviewsByCompletedTrainer, trainerNameById, user?.id]);
  const profileDisplayName = profileQuery.data?.full_name?.trim() || user?.full_name || user?.email || "Client";
  const roleLabel = profileQuery.data?.role ? `${profileQuery.data.role.charAt(0).toUpperCase()}${profileQuery.data.role.slice(1)}` : "Client";
  const nameLocked = Boolean(profileQuery.data?.full_name?.trim());
  const avatarInitial = profileDisplayName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
    const savedAvatar = profileQuery.data.avatar_url ?? "";
    setAvatarUrl(savedAvatar);
    setAvatarEditorSrc(savedAvatar || null);
  }, [profileQuery.data]);

  function handleAvatarFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please drop a valid image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result ?? "");
      setError("");
      setAvatarEditorSrc(src);
      setAvatarUrl(src);
      setAvatarZoom(1);
      setAvatarOffsetX(0);
      setAvatarOffsetY(0);
    };
    reader.onerror = () => setError("Failed to read image file.");
    reader.readAsDataURL(file);
  }

  async function applyAvatarCrop() {
    if (!avatarEditorSrc) return;
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load selected image."));
        img.src = avatarEditorSrc;
      });

      const previewSize = 220;
      const outputSize = 512;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Unable to process image.");

      const baseScale = Math.max(outputSize / image.naturalWidth, outputSize / image.naturalHeight);
      const scale = baseScale * avatarZoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const drawX = (outputSize - drawWidth) / 2 + (avatarOffsetX * outputSize) / previewSize;
      const drawY = (outputSize - drawHeight) / 2 + (avatarOffsetY * outputSize) / previewSize;
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);

      const croppedDataUrl = canvas.toDataURL("image/png");
      setAvatarUrl(croppedDataUrl);
      setAvatarEditorSrc(croppedDataUrl);
      setError("");
    } catch (e) {
      setError((e as Error).message || "Failed to process avatar image.");
    }
  }

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(token, {
        fullName: nameLocked ? undefined : fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: timezone.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const sendOtpMutation = useMutation({
    mutationFn: () => sendPhoneOtp(token, phone.trim()),
    onSuccess: (payload) => {
      setError("");
      setOtpStatus("OTP sent to your phone number.");
      setOtpPreview(payload.otpPreview ?? "");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const verifyOtpMutation = useMutation({
    mutationFn: () => verifyPhoneOtp(token, otpCode.trim()),
    onSuccess: () => {
      setError("");
      setOtpStatus("Phone number verified.");
      setOtpCode("");
      setOtpPreview("");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <div className="profile-hero">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profileDisplayName}
            className="profile-hero-avatar"
          />
        ) : (
          <div className="profile-hero-avatar profile-hero-avatar-fallback">{avatarInitial}</div>
        )}
        <div>
          <h2 style={{ margin: 0 }}>{`Hi, ${profileDisplayName}`}</h2>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            {roleLabel}
          </p>
        </div>
      </div>
      <p className="muted">View and update your account profile details.</p>

      <div className="card profile-details-card">
        <h3>Profile details</h3>
        {profileQuery.isLoading ? <p>Loading profile...</p> : null}
        {profileQuery.data ? (
          <p className="muted">
            Role: <b>{profileQuery.data.role}</b>
          </p>
        ) : null}

        {!isEditing ? (
          <>
            <div className="profile-view-grid">
              <article className="profile-view-item">
                <p className="profile-view-label">Name</p>
                <p className="profile-view-value">{fullName || "Not set"}</p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Phone</p>
                <p className="profile-view-value">
                  {phone || "Not set"}{" "}
                  {profileQuery.data?.phone_verified ? (
                    <span className="badge badge-success">Verified</span>
                  ) : (
                    <span className="badge badge-muted">Not verified</span>
                  )}
                </p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Timezone</p>
                <p className="profile-view-value">{timezone || "Not set"}</p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Account role</p>
                <p className="profile-view-value">{roleLabel}</p>
              </article>
            </div>
            <button className="primary-btn" onClick={() => setIsEditing(true)}>
              Edit profile
            </button>
          </>
        ) : (
          <>
            <label>Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              disabled={nameLocked}
            />
            {nameLocked ? <p className="muted">Name is locked after initial setup for client accounts.</p> : null}

            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61..." />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
              <button
                className="secondary-btn otp-btn-sm"
                type="button"
                disabled={!phone.trim() || sendOtpMutation.isPending}
                onClick={() => sendOtpMutation.mutate()}
              >
                {sendOtpMutation.isPending ? "Sending OTP..." : "Send OTP"}
              </button>
              <input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                style={{ maxWidth: 180 }}
              />
              <button
                className="secondary-btn otp-btn-sm"
                type="button"
                disabled={otpCode.trim().length !== 6 || verifyOtpMutation.isPending}
                onClick={() => verifyOtpMutation.mutate()}
              >
                {verifyOtpMutation.isPending ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
            {otpStatus ? <p className="muted">{otpStatus}</p> : null}
            {otpPreview ? <p className="muted">Dev OTP: {otpPreview}</p> : null}

            <label>Timezone</label>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Australia/Melbourne" />

            <label>Avatar URL</label>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="Paste an image URL or drop a file below"
            />
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  if (!avatarUrl.trim()) return;
                  setAvatarEditorSrc(avatarUrl.trim());
                  setAvatarZoom(1);
                  setAvatarOffsetX(0);
                  setAvatarOffsetY(0);
                }}
              >
                Load URL for editing
              </button>
              <button className="secondary-btn" type="button" onClick={() => avatarFileInputRef.current?.click()}>
                Upload image
              </button>
            </div>
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={(e) => handleAvatarFiles(e.target.files)}
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingAvatar(true);
              }}
              onDragLeave={() => setIsDraggingAvatar(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingAvatar(false);
                handleAvatarFiles(e.dataTransfer.files);
              }}
              style={{
                marginTop: "0.6rem",
                border: `1px dashed ${isDraggingAvatar ? "#818cf8" : "var(--border-light)"}`,
                borderRadius: "0.75rem",
                padding: "0.9rem",
                background: isDraggingAvatar ? "rgba(79, 70, 229, 0.08)" : "rgba(255,255,255,0.02)",
              }}
            >
              <p className="muted" style={{ margin: 0 }}>
                Drag and drop an image here, then adjust before saving.
              </p>
            </div>

            {avatarEditorSrc ? (
              <div style={{ marginTop: "0.75rem" }}>
                <div
                  style={{
                    width: 220,
                    height: 220,
                    borderRadius: "9999px",
                    overflow: "hidden",
                    border: "2px solid var(--border-light)",
                    marginBottom: "0.75rem",
                    position: "relative",
                    background: "#0b1220",
                  }}
                >
                  <img
                    src={avatarEditorSrc}
                    alt="Avatar preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: `calc(50% + ${avatarOffsetX}px) calc(50% + ${avatarOffsetY}px)`,
                      transform: `scale(${avatarZoom})`,
                      transformOrigin: "center",
                      display: "block",
                    }}
                  />
                </div>
                <label>Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={avatarZoom}
                  onChange={(e) => setAvatarZoom(Number(e.target.value))}
                />
                <label>Horizontal adjust</label>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={avatarOffsetX}
                  onChange={(e) => setAvatarOffsetX(Number(e.target.value))}
                />
                <label>Vertical adjust</label>
                <input
                  type="range"
                  min={-80}
                  max={80}
                  step={1}
                  value={avatarOffsetY}
                  onChange={(e) => setAvatarOffsetY(Number(e.target.value))}
                />
                <button className="secondary-btn" type="button" onClick={() => void applyAvatarCrop()}>
                  Apply avatar crop
                </button>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="primary-btn" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </button>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError("");
                  const profile = profileQuery.data;
                  if (!profile) return;
                  setFullName(profile.full_name ?? "");
                  setPhone(profile.phone ?? "");
                  setTimezone(profile.timezone ?? "");
                  const savedAvatar = profile.avatar_url ?? "";
                  setAvatarUrl(savedAvatar);
                  setAvatarEditorSrc(savedAvatar || null);
                  setAvatarZoom(1);
                  setAvatarOffsetX(0);
                  setAvatarOffsetY(0);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>My given reviews</h3>
        <p className="muted">Reviews you have posted for completed services.</p>
        {bookingsQuery.isLoading ? <p>Loading your reviews...</p> : null}
        {!bookingsQuery.isLoading && myReviews.length === 0 ? <p className="muted">No reviews posted yet.</p> : null}
        <ul className="list">
          {myReviews.map((review) => (
            <li key={review.id}>
              <span>
                <b>{review.trainerName}</b> · <StarDisplay value={review.rating} /> ({review.rating}/5)
                {review.comment ? ` - ${review.comment}` : " - No comment"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <style>{`
        .profile-hero {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.35rem;
        }
        .profile-hero-avatar {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
        }
        .profile-hero-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, var(--primary), var(--accent));
          color: #fff;
          font-weight: 800;
          font-size: 1.65rem;
        }
        .profile-hero h2 {
          font-size: 2rem;
          line-height: 1.1;
        }
        .profile-details-card {
          padding: 1.35rem;
        }
        .profile-view-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.85rem;
          margin-bottom: 1rem;
        }
        .profile-view-item {
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          padding: 0.95rem 1rem;
          background: rgba(255, 255, 255, 0.02);
        }
        .profile-view-label {
          margin: 0 0 0.35rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-muted);
          font-weight: 700;
        }
        .profile-view-value {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .otp-btn-sm {
          padding: 0.38rem 0.72rem;
          font-size: 0.78rem;
          min-height: 30px;
        }
      `}</style>
    </section>
  );
}
