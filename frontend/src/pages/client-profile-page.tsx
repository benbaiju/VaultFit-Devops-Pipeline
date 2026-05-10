import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, MapPin, Pencil, Share2, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { format, isValid, parseISO, startOfDay } from "date-fns";
import { getBookings } from "../services/bookings";
import { getPlans } from "../services/plans";
import { getTrainerReviews } from "../services/reviews";
import { getServices } from "../services/services";
import { getTrainers } from "../services/trainers";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../services/profiles";
import { ROUTES } from "../lib/navigation";
import { useAuth } from "../state/auth-context";
import type { Booking, Profile } from "../types/api";

const PROFILE_EXTRAS_KEY = "vaultfit_client_profile_extras_v1";

type ProfileExtras = {
  bio: string;
  city: string;
  instagram: string;
  linkedin: string;
};

function loadExtras(): ProfileExtras {
  try {
    const raw = localStorage.getItem(PROFILE_EXTRAS_KEY);
    if (!raw) return { bio: "", city: "", instagram: "", linkedin: "" };
    const p = JSON.parse(raw) as Partial<ProfileExtras>;
    return {
      bio: typeof p.bio === "string" ? p.bio : "",
      city: typeof p.city === "string" ? p.city : "",
      instagram: typeof p.instagram === "string" ? p.instagram : "",
      linkedin: typeof p.linkedin === "string" ? p.linkedin : "",
    };
  } catch {
    return { bio: "", city: "", instagram: "", linkedin: "" };
  }
}

function persistExtras(extras: ProfileExtras) {
  localStorage.setItem(PROFILE_EXTRAS_KEY, JSON.stringify(extras));
}

function bookingDurationLabel(booking: Booking, durationMinutes?: number | null): string {
  if (durationMinutes != null && durationMinutes > 0) {
    if (durationMinutes >= 120) return `${Math.round(durationMinutes / 60)} hours`;
    if (durationMinutes >= 60) return `${Math.round(durationMinutes / 60)} hour`;
    return `${durationMinutes} Mins`;
  }
  const parse = (t: string) => {
    const parts = t.split(":").map(Number);
    const h = parts[0] ?? 0;
    const m = parts[1] ?? 0;
    return h * 60 + m;
  };
  let mins = parse(booking.end_time) - parse(booking.start_time);
  if (mins <= 0) mins = 60;
  if (mins >= 120) return `${Math.round(mins / 60)} hours`;
  if (mins >= 60) return `${Math.round(mins / 60)} hour`;
  return `${mins} Mins`;
}

/**
 * Profile strength score. `avatarForCompletion` is the effective image (saved URL or in-progress edit)
 * so the bar updates while the user works in the editor, not only after refetch.
 */
function profileCompletionPercent(
  profile: Profile | undefined,
  extras: ProfileExtras,
  avatarForCompletion: string,
): number {
  if (!profile) return 0;
  let score = 0;
  if (profile.full_name?.trim()) score += 22;
  if (avatarForCompletion.trim()) score += 22;
  if (profile.phone_verified) score += 22;
  if (profile.timezone?.trim()) score += 14;
  if (extras.bio.trim()) score += 12;
  if (extras.city.trim()) score += 8;
  return Math.min(100, score);
}

type ProfileCompletionRow = {
  id: string;
  label: string;
  points: number;
  done: boolean;
  hint: string;
};

/** One row per scoring rule — used for the “what’s left” checklist in Performance. */
function buildProfileCompletionChecklist(
  profile: Profile | undefined,
  extras: ProfileExtras,
  avatarForCompletion: string,
): ProfileCompletionRow[] {
  if (!profile) return [];

  const phoneTrimmed = profile.phone?.trim() ?? "";
  const hasPhone = Boolean(phoneTrimmed);

  return [
    {
      id: "name",
      label: "Full name",
      points: 22,
      done: Boolean(profile.full_name?.trim()),
      hint: "Open Edit profile and set your display name.",
    },
    {
      id: "avatar",
      label: "Profile photo",
      points: 22,
      done: Boolean(avatarForCompletion.trim()),
      hint: "Upload an image or paste an avatar URL, then save.",
    },
    {
      id: "phone",
      label: "Verified phone number",
      points: 22,
      done: Boolean(profile.phone_verified),
      hint: !hasPhone
        ? "Add a mobile number and tap Send OTP."
        : "Enter the 6-digit code sent to your phone to verify.",
    },
    {
      id: "timezone",
      label: "Timezone",
      points: 14,
      done: Boolean(profile.timezone?.trim()),
      hint: "Add your region’s timezone (booking times stay accurate).",
    },
    {
      id: "bio",
      label: "Bio",
      points: 12,
      done: Boolean(extras.bio.trim()),
      hint: "Tell trainers about your goals and background.",
    },
    {
      id: "city",
      label: "City or region",
      points: 8,
      done: Boolean(extras.city.trim()),
      hint: "Shown on your profile so pros know your area.",
    },
  ];
}

export function ClientProfilePage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const settingsRef = useRef<HTMLDivElement>(null);
  const [extras, setExtras] = useState<ProfileExtras>(() => loadExtras());
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
    staleTime: 0,
    refetchOnMount: "always",
  });
  const trainersQuery = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
    staleTime: 60_000,
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const completedBookings = useMemo(
    () => (bookingsQuery.data ?? []).filter((booking) => booking.status === "completed"),
    [bookingsQuery.data],
  );

  const upcomingBookings = useMemo(() => {
    const today = startOfDay(new Date());
    return (bookingsQuery.data ?? [])
      .filter((b) => {
        if (b.status !== "pending" && b.status !== "confirmed") return false;
        const d = parseISO(b.booking_date);
        if (!isValid(d)) return false;
        return startOfDay(d).getTime() >= today.getTime();
      })
      .sort((a, b) => {
        const da = parseISO(a.booking_date).getTime();
        const db = parseISO(b.booking_date).getTime();
        if (da !== db) return da - db;
        return a.start_time.localeCompare(b.start_time);
      })
      .slice(0, 8);
  }, [bookingsQuery.data]);

  const completedTrainerServiceIds = useMemo(
    () => Array.from(new Set(completedBookings.map((booking) => booking.trainer_id).filter((id): id is string => Boolean(id)))),
    [completedBookings],
  );

  const servicesByTrainer = useQueries({
    queries: completedTrainerServiceIds.map((trainerId) => ({
      queryKey: ["services", trainerId],
      queryFn: () => getServices(trainerId),
      enabled: Boolean(trainerId),
    })),
  });

  const serviceMetaById = useMemo(() => {
    const map = new Map<string, { title: string; durationMinutes: number }>();
    servicesByTrainer.forEach((query) => {
      (query.data ?? []).forEach((service) => {
        map.set(service.id, { title: service.title, durationMinutes: service.duration_minutes });
      });
    });
    return map;
  }, [servicesByTrainer]);

  const completedTrainerIds = useMemo(
    () =>
      Array.from(new Set(completedBookings.map((booking) => booking.trainer_id).filter((id): id is string => Boolean(id)))),
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
    const rows: Array<{ id: string; rating: number }> = [];
    reviewsByCompletedTrainer.forEach((query) => {
      (query.data ?? []).forEach((review) => {
        if (review.client_id !== user?.id) return;
        rows.push({ id: review.id, rating: review.rating });
      });
    });
    return rows;
  }, [reviewsByCompletedTrainer, user?.id]);

  const reviewsAvgGiven =
    myReviews.length > 0 ? myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length : null;

  /** Avatar counts toward completion when saved on the profile OR staged while editing (preview updates immediately). */
  const avatarForCompletion = useMemo(() => {
    const saved = profileQuery.data?.avatar_url?.trim();
    if (saved) return saved;
    if (isEditing && avatarUrl.trim()) return avatarUrl.trim();
    return "";
  }, [profileQuery.data?.avatar_url, isEditing, avatarUrl]);

  const completionPct = useMemo(
    () => profileCompletionPercent(profileQuery.data, extras, avatarForCompletion),
    [profileQuery.data, extras, avatarForCompletion],
  );

  const completionChecklist = useMemo(
    () => buildProfileCompletionChecklist(profileQuery.data, extras, avatarForCompletion),
    [profileQuery.data, extras, avatarForCompletion],
  );

  const incompleteProfileItems = useMemo(
    () => completionChecklist.filter((row) => !row.done),
    [completionChecklist],
  );

  const performanceStats = useMemo(() => {
    const bookings = bookingsQuery.data ?? [];
    const plans = plansQuery.data ?? [];
    const completedSessions = bookings.filter((b) => b.status === "completed").length;
    const upcomingSessions = bookings.filter((b) => b.status === "pending" || b.status === "confirmed").length;
    const scheduledTotal = bookings.filter((b) => b.status !== "cancelled").length;
    return {
      plansCount: plans.length,
      completedSessions,
      upcomingSessions,
      scheduledTotal,
    };
  }, [bookingsQuery.data, plansQuery.data]);

  useEffect(() => {
    if (!profileQuery.isSuccess || isEditing) return;
    setExtras(loadExtras());
  }, [profileQuery.dataUpdatedAt, profileQuery.isSuccess, isEditing]);

  const profileDisplayName = profileQuery.data?.full_name?.trim() || user?.full_name || user?.email || "User";
  const roleLabel = profileQuery.data?.role ? `${profileQuery.data.role.charAt(0).toUpperCase()}${profileQuery.data.role.slice(1)}` : "Client";
  const nameLocked = Boolean(profileQuery.data?.full_name?.trim());
  const avatarInitial = profileDisplayName.charAt(0).toUpperCase();
  const normalizedCurrentPhone = phone.trim().replace(/[\s\-()]/g, "");
  const normalizedSavedPhone = (profileQuery.data?.phone ?? "").trim().replace(/[\s\-()]/g, "");
  const phoneAlreadyVerifiedForCurrentInput =
    Boolean(profileQuery.data?.phone_verified) &&
    Boolean(normalizedCurrentPhone) &&
    normalizedCurrentPhone === normalizedSavedPhone;

  const sortedCompletedSessions = useMemo(
    () =>
      [...completedBookings].sort(
        (a, b) => parseISO(b.booking_date).getTime() - parseISO(a.booking_date).getTime(),
      ),
    [completedBookings],
  );

  const bioDisplay =
    extras.bio.trim() ||
    "Tell trainers about your goals — open Edit profile to add a short bio (saved on this device until synced server-side).";

  const locationDisplay =
    extras.city.trim() ||
    (profileQuery.data?.timezone?.trim()
      ? profileQuery.data.timezone.replace(/_/g, " ")
      : "Add your city in Edit profile");

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
    const savedAvatar = profileQuery.data.avatar_url ?? "";
    setAvatarUrl(savedAvatar);
    setAvatarEditorSrc(savedAvatar || null);
  }, [profileQuery.data]);

  useEffect(() => {
    if (!isEditing) return;
    settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isEditing]);

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
      persistExtras(extras);
      setExtras(loadExtras());
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
      void queryClient.invalidateQueries({ queryKey: ["bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["plans"] });
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
    <section className="cp-page">
      <header className="cp-toolbar">
        <p className="cp-toolbar-lead muted">Your VaultFit client presence — sessions, plans, and reviews.</p>
        <button type="button" className="secondary-btn cp-edit-trigger" onClick={() => setIsEditing((v) => !v)}>
          <Pencil size={18} aria-hidden />
          {isEditing ? "Close editor" : "Edit profile"}
        </button>
      </header>

      <div className="cp-layout">
        <div className="cp-main">
          <div className="cp-hero card glass-card">
            <div className="cp-banner" aria-hidden />
            <div className="cp-hero-body">
              <div className="cp-avatar-wrap">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="cp-avatar-img" />
                ) : (
                  <div className="cp-avatar-fallback">{avatarInitial}</div>
                )}
              </div>
              <div className="cp-hero-info">
                <div className="cp-hero-top">
                  <div>
                    <h2 className="cp-name">{profileDisplayName}</h2>
                    <p className="cp-role muted">{roleLabel}</p>
                    <p className="cp-location">
                      <MapPin size={16} aria-hidden />
                      {locationDisplay}
                    </p>
                  </div>
                  <div className="cp-social">
                    {extras.instagram.trim() ? (
                      <a
                        href={extras.instagram.startsWith("http") ? extras.instagram : `https://instagram.com/${extras.instagram.replace("@", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cp-social-btn"
                        aria-label="Instagram"
                      >
                        <Share2 size={20} />
                      </a>
                    ) : null}
                    {extras.linkedin.trim() ? (
                      <a
                        href={extras.linkedin.startsWith("http") ? extras.linkedin : `https://${extras.linkedin}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cp-social-btn"
                        aria-label="LinkedIn"
                      >
                        <Briefcase size={20} />
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="cp-rating-row">
                  {reviewsAvgGiven != null ? (
                    <>
                      <Star className="cp-star-icon" size={18} aria-hidden />
                      <span className="cp-rating-num">{reviewsAvgGiven.toFixed(1)}</span>
                      <span className="muted">({myReviews.length} reviews shared)</span>
                    </>
                  ) : (
                    <span className="muted">No reviews shared yet — complete a session and leave feedback.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="cp-card card glass-card">
            <h3 className="cp-section-title">Professional Bio</h3>
            <p className="cp-bio-text">{bioDisplay}</p>
          </div>

          <div className="cp-card card glass-card">
            <h3 className="cp-section-title">Previous Sessions</h3>
            {bookingsQuery.isLoading ? <p className="muted">Loading sessions…</p> : null}
            {!bookingsQuery.isLoading && sortedCompletedSessions.length === 0 ? (
              <p className="muted">No completed sessions yet.</p>
            ) : (
              <ul className="cp-session-list">
                {sortedCompletedSessions.slice(0, 12).map((booking) => {
                  const meta = booking.service_id ? serviceMetaById.get(booking.service_id) : undefined;
                  const title = meta?.title ?? "Session";
                  const dur = bookingDurationLabel(booking, meta?.durationMinutes ?? null);
                  const trainerName = booking.trainer_id ? (trainerNameById.get(booking.trainer_id) ?? "Trainer") : "";
                  return (
                    <li key={booking.id} className="cp-session-card">
                      <div>
                        <p className="cp-session-title">{title}</p>
                        <p className="cp-session-sub muted">
                          {format(parseISO(booking.booking_date), "MMM d, yyyy")}
                          {trainerName ? ` · ${trainerName}` : ""}
                        </p>
                      </div>
                      <span className="cp-session-dur">{dur}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {isEditing ? (
            <div ref={settingsRef} className="cp-card card cp-settings">
              <h3 className="cp-section-title">Profile details</h3>
              {profileQuery.isLoading ? <p>Loading profile...</p> : null}
              {profileQuery.data ? (
                <p className="muted">
                  Role: <b>{profileQuery.data.role}</b>
                </p>
              ) : null}

              <label>Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                disabled={nameLocked}
              />
              {nameLocked ? <p className="muted">Name is locked after initial setup for client accounts.</p> : null}

              <label>Bio</label>
              <textarea
                rows={4}
                value={extras.bio}
                onChange={(e) => setExtras((x) => ({ ...x, bio: e.target.value }))}
                placeholder="Share your goals and background with trainers."
                className="cp-textarea"
              />

              <label>City / region</label>
              <input
                value={extras.city}
                onChange={(e) => setExtras((x) => ({ ...x, city: e.target.value }))}
                placeholder="e.g. Los Angeles, CA"
              />

              <label>Instagram</label>
              <input
                value={extras.instagram}
                onChange={(e) => setExtras((x) => ({ ...x, instagram: e.target.value }))}
                placeholder="@username or full URL"
              />

              <label>LinkedIn</label>
              <input
                value={extras.linkedin}
                onChange={(e) => setExtras((x) => ({ ...x, linkedin: e.target.value }))}
                placeholder="Profile URL"
              />

              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61..." />
              <div className="phone-otp-row">
                <button
                  className="secondary-btn otp-btn-sm"
                  type="button"
                  disabled={!phone.trim() || sendOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
                  onClick={() => sendOtpMutation.mutate()}
                >
                  {sendOtpMutation.isPending
                    ? "Sending OTP..."
                    : phoneAlreadyVerifiedForCurrentInput
                      ? "Already verified"
                      : "Send OTP"}
                </button>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit OTP"
                  maxLength={6}
                  className="otp-code-input"
                />
                <button
                  className="secondary-btn otp-btn-sm"
                  type="button"
                  disabled={otpCode.trim().length !== 6 || verifyOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
                  onClick={() => verifyOtpMutation.mutate()}
                >
                  {verifyOtpMutation.isPending
                    ? "Verifying..."
                    : phoneAlreadyVerifiedForCurrentInput
                      ? "Verified"
                      : "Verify OTP"}
                </button>
              </div>
              {phoneAlreadyVerifiedForCurrentInput ? (
                <p className="muted">This phone is already verified. Verification is only needed if you change the number.</p>
              ) : null}
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

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
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
                    setExtras(loadExtras());
                  }}
                >
                  Cancel
                </button>
              </div>
              {error ? <p className="error">{error}</p> : null}
            </div>
          ) : null}
        </div>

        <aside className="cp-aside">
          <div className="cp-widget card glass-card">
            <h3 className="cp-widget-title">Upcoming Sessions</h3>
            {bookingsQuery.isLoading ? <p className="muted">Loading…</p> : null}
            {!bookingsQuery.isLoading && upcomingBookings.length === 0 ? (
              <p className="muted cp-widget-empty">Nothing scheduled. Book a session to see it here.</p>
            ) : (
              <ul className="cp-upcoming-list">
                {upcomingBookings.map((b) => {
                  const day = format(parseISO(b.booking_date), "EEEE");
                  const start = b.start_time.slice(0, 5);
                  const end = b.end_time.slice(0, 5);
                  return (
                    <li key={b.id}>
                      <span className="cp-up-day">{day}</span>
                      <span className="cp-up-time muted">
                        {start} – {end}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link to={ROUTES.client.book} className="secondary-btn cp-widget-btn">
              Manage calendar
            </Link>
          </div>

          <div className="cp-widget card glass-card">
            <h3 className="cp-widget-title">Performance</h3>
            <p className="cp-perf-label muted">Profile completion</p>
            <div className="cp-progress-wrap">
              <div className="cp-progress-bar" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="cp-perf-pct">{completionPct}%</p>
            {profileQuery.isLoading ? (
              <p className="cp-perf-foot muted">Loading completion checklist…</p>
            ) : profileQuery.isError ? (
              <p className="cp-perf-foot muted">Profile couldn’t load. Check your connection and refresh.</p>
            ) : completionPct >= 100 ? (
              <p className="cp-check-all-done">Profile complete — all sections filled.</p>
            ) : incompleteProfileItems.length === 0 ? (
              <p className="cp-perf-foot muted">Unable to build checklist — refresh the page.</p>
            ) : (
              <>
                <p className="cp-check-intro muted">Finish these in Edit profile to reach 100% (each adds up on the bar).</p>
                <ul className="cp-check-list">
                  {incompleteProfileItems.map((item) => (
                    <li key={item.id} className="cp-check-item">
                      <span className="cp-check-points">+{item.points}%</span>
                      <div className="cp-check-body">
                        <span className="cp-check-label">{item.label}</span>
                        <span className="cp-check-hint muted">{item.hint}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <button type="button" className="cp-check-edit-link" onClick={() => setIsEditing(true)}>
                  Open Edit profile
                </button>
              </>
            )}
            <div className="cp-stat-grid">
              <div className="cp-stat-box">
                <span className="cp-stat-num">
                  {plansQuery.isLoading ? "–" : performanceStats.plansCount}
                </span>
                <span className="cp-stat-label muted">YOUR PLANS</span>
              </div>
              <div className="cp-stat-box">
                <span className="cp-stat-num">
                  {bookingsQuery.isLoading ? "–" : performanceStats.completedSessions}
                </span>
                <span className="cp-stat-label muted">SESSIONS DONE</span>
              </div>
            </div>
            {!bookingsQuery.isLoading ? (
              <p className="cp-perf-sub muted">
                {performanceStats.upcomingSessions} upcoming
                {performanceStats.scheduledTotal ? ` · ${performanceStats.scheduledTotal} scheduled (excl. cancelled)` : ""}
              </p>
            ) : null}
          </div>
        </aside>
      </div>

      <style>{`
        .cp-page {
          max-width: 1100px;
          margin: 0 auto;
        }
        .cp-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        .cp-toolbar-lead {
          margin: 0;
          max-width: 42rem;
        }
        .cp-edit-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
        }
        .cp-layout {
          display: grid;
          grid-template-columns: 1fr min(300px, 34%);
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 920px) {
          .cp-layout {
            grid-template-columns: 1fr;
          }
        }
        .cp-main {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          min-width: 0;
        }
        .cp-hero {
          padding: 0;
          overflow: hidden;
          border-radius: 16px;
        }
        .cp-banner {
          height: 120px;
          background: linear-gradient(135deg, rgba(30, 58, 138, 0.95), rgba(15, 23, 42, 1));
          border-bottom: 1px solid var(--border-light);
        }
        .cp-hero-body {
          display: flex;
          gap: 1.15rem;
          padding: 0 1.35rem 1.35rem;
          margin-top: -48px;
          position: relative;
        }
        .cp-avatar-wrap {
          flex-shrink: 0;
          width: 112px;
          height: 112px;
          border-radius: 14px;
          overflow: hidden;
          border: 3px solid rgba(15, 23, 42, 0.95);
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
          background: #0b1220;
        }
        .cp-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .cp-avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.25rem;
          font-weight: 800;
          color: #fff;
          background: linear-gradient(135deg, var(--primary), var(--accent));
        }
        .cp-hero-info {
          flex: 1;
          min-width: 0;
          padding-top: 52px;
        }
        .cp-hero-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .cp-name {
          margin: 0 0 0.2rem;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .cp-role {
          margin: 0 0 0.35rem;
          font-size: 0.88rem;
          text-transform: capitalize;
        }
        .cp-location {
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.88rem;
          color: var(--text-secondary);
        }
        .cp-social {
          display: flex;
          gap: 0.35rem;
          flex-shrink: 0;
        }
        .cp-social-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
        }
        .cp-social-btn:hover {
          color: #fff;
          border-color: rgba(129, 140, 248, 0.45);
        }
        .cp-rating-row {
          margin-top: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
          font-size: 0.9rem;
        }
        .cp-star-icon {
          color: #fbbf24;
          fill: #fbbf24;
        }
        .cp-rating-num {
          font-weight: 800;
          color: #fff;
        }
        .cp-card {
          padding: 1.25rem 1.35rem;
        }
        .cp-section-title {
          margin: 0 0 0.75rem;
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .cp-bio-text {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.55;
          color: var(--text-secondary);
        }
        .cp-session-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .cp-session-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.18);
        }
        .cp-session-title {
          margin: 0 0 0.2rem;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .cp-session-sub {
          margin: 0;
          font-size: 0.8rem;
        }
        .cp-session-dur {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-secondary);
          white-space: nowrap;
        }
        .cp-settings label {
          margin-top: 0.75rem;
        }
        .cp-textarea {
          width: 100%;
          box-sizing: border-box;
          min-height: 5rem;
          resize: vertical;
        }
        .cp-aside {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .cp-widget {
          padding: 1.15rem 1.2rem;
        }
        .cp-widget-title {
          margin: 0 0 0.85rem;
          font-size: 0.95rem;
          font-weight: 800;
        }
        .cp-widget-empty {
          margin: 0 0 0.85rem;
          font-size: 0.85rem;
        }
        .cp-upcoming-list {
          list-style: none;
          margin: 0 0 1rem;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .cp-upcoming-list li {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 0.5rem;
          font-size: 0.86rem;
        }
        .cp-up-day {
          font-weight: 700;
        }
        .cp-widget-btn {
          width: 100%;
          justify-content: center;
          text-decoration: none;
          box-sizing: border-box;
          display: inline-flex;
        }
        .cp-perf-label {
          margin: 0 0 0.35rem;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .cp-progress-wrap {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          overflow: hidden;
          margin-bottom: 0.35rem;
        }
        .cp-progress-bar {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #22c55e, #38bdf8);
          transition: width 0.3s ease;
        }
        .cp-perf-pct {
          margin: 0 0 0.35rem;
          font-weight: 800;
          font-size: 1.1rem;
        }
        .cp-perf-foot {
          margin: 0 0 1rem;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .cp-check-intro {
          margin: 0 0 0.65rem;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .cp-check-all-done {
          margin: 0 0 1rem;
          font-size: 0.84rem;
          font-weight: 600;
          color: #86efac;
        }
        .cp-check-list {
          list-style: none;
          margin: 0 0 0.75rem;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
          max-height: 220px;
          overflow-y: auto;
        }
        .cp-check-item {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          padding: 0.45rem 0.5rem;
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(148, 163, 184, 0.15);
        }
        .cp-check-points {
          flex-shrink: 0;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          color: #fcd34d;
          padding-top: 0.1rem;
        }
        .cp-check-body {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 0;
        }
        .cp-check-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .cp-check-hint {
          font-size: 0.74rem;
          line-height: 1.35;
        }
        .cp-check-edit-link {
          margin: 0 0 1rem;
          padding: 0;
          border: none;
          background: none;
          color: #7dd3fc;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .cp-check-edit-link:hover {
          color: #bae6fd;
        }
        .cp-perf-sub {
          margin: 0.65rem 0 0;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .cp-stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.65rem;
        }
        .cp-stat-box {
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.2);
          text-align: center;
        }
        .cp-stat-num {
          display: block;
          font-size: 1.35rem;
          font-weight: 800;
          color: #fff;
        }
        .cp-stat-label {
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.08em;
        }
        .otp-btn-sm {
          padding: 0 0.72rem;
          font-size: 0.8rem;
          min-height: 34px;
          border-radius: 10px;
        }
        .phone-otp-row {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-top: 0.35rem;
          align-items: center;
        }
        .otp-code-input {
          max-width: 170px;
          min-height: 34px;
        }
      `}</style>
    </section>
  );
}
