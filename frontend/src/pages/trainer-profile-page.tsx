import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Award, Calendar, CheckCircle2, Globe, GraduationCap, Pencil, Share2, Star } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, isBefore, parseISO, startOfDay } from "date-fns";
import { ROUTES } from "../lib/navigation";
import { getAvailability } from "../services/availability";
import { getBookings } from "../services/bookings";
import { getPlans } from "../services/plans";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../services/profiles";
import { getTrainerReviews } from "../services/reviews";
import { getServices } from "../services/services";
import { createMyTrainerProfile, getMyTrainerProfile, updateMyTrainerProfile } from "../services/trainers";
import { getMyVerificationRequests } from "../services/verification";
import { useAuth } from "../state/auth-context";
import type { AvailabilitySlot, Trainer } from "../types/api";

const WEEKDAY_MON0 = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function publicTrainerProfileUrl(trainerId: string): string {
  const path = `${ROUTES.client.trainers}/${trainerId}`;
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}

function formatBookingListDate(isoDate: string): string {
  try {
    return format(parseISO(isoDate), "EEE, MMM d, yyyy");
  } catch {
    return isoDate;
  }
}

function fmtClock(t: string): string {
  return t.slice(0, 5);
}

function parseExpertiseTagsFromTrainer(me: Trainer | null | undefined): string[] {
  if (!me?.expertise_tags) return [];
  const raw = me.expertise_tags;
  if (!Array.isArray(raw)) return [];
  const out = raw
    .filter((x): x is string => typeof x === "string")
    .map((t) => t.trim())
    .filter(Boolean);
  return [...new Set(out)].slice(0, 24);
}

function summarizeAvailability(slots: AvailabilitySlot[]): string[] {
  if (slots.length === 0) return [];
  const byDay = new Map<number, { start: string; end: string }>();
  for (const s of slots) {
    const prev = byDay.get(s.day_of_week);
    const cur = { start: s.start_time, end: s.end_time };
    if (!prev) {
      byDay.set(s.day_of_week, cur);
      continue;
    }
    if (prev.start === cur.start && prev.end === cur.end) continue;
    byDay.set(s.day_of_week, cur);
  }
  const lines: string[] = [];
  for (let d = 0; d < 7; d++) {
    const row = byDay.get(d);
    if (!row) continue;
    lines.push(`${WEEKDAY_MON0[d]} · ${fmtClock(row.start)} – ${fmtClock(row.end)}`);
  }
  return lines;
}

export function TrainerProfilePage() {
  const { token, user, refreshUserDisplay } = useAuth();
  const queryClient = useQueryClient();
  const [bio, setBio] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experienceYears, setExperienceYears] = useState(0);
  const [hourlyRate, setHourlyRate] = useState(90);
  const [phone, setPhone] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpPreview, setOtpPreview] = useState("");
  const [otpStatus, setOtpStatus] = useState("");
  const [error, setError] = useState("");
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [fullName, setFullName] = useState("");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
  });
  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });

  const verificationQuery = useQuery({
    queryKey: ["trainer-verification-requests"],
    queryFn: () => getMyVerificationRequests(token),
  });
  const reviewsQuery = useQuery({
    queryKey: ["reviews", meQuery.data?.id ?? ""],
    queryFn: () => getTrainerReviews(meQuery.data!.id),
    enabled: Boolean(meQuery.data?.id),
  });
  const bookingsQuery = useQuery({
    queryKey: ["bookings"],
    queryFn: () => getBookings(token),
  });
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: () => getPlans(token),
    enabled: Boolean(meQuery.data?.id),
  });
  const servicesQuery = useQuery({
    queryKey: ["services", meQuery.data?.id ?? ""],
    queryFn: () => getServices(meQuery.data!.id),
    enabled: Boolean(meQuery.data?.id),
  });

  const primaryServiceId = useMemo(() => {
    const list = servicesQuery.data ?? [];
    const active = list.find((s) => s.is_active);
    return active?.id ?? list[0]?.id ?? "";
  }, [servicesQuery.data]);

  const availabilityQuery = useQuery({
    queryKey: ["availability-profile", meQuery.data?.id, primaryServiceId],
    queryFn: () => getAvailability(meQuery.data!.id, primaryServiceId),
    enabled: Boolean(meQuery.data?.id && primaryServiceId),
  });

  useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    setBio(me.bio ?? "");
    setSpecialty(me.specialty ?? "");
    setExperienceYears(me.experience_years ?? 0);
    setHourlyRate(me.hourly_rate ?? 0);
    setExpertiseTags(parseExpertiseTagsFromTrainer(me));
  }, [meQuery.data]);
  useEffect(() => {
    setPhone(profileQuery.data?.phone ?? "");
    setFullName(profileQuery.data?.full_name?.trim() ?? "");
  }, [profileQuery.data?.phone, profileQuery.data?.full_name]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const normalizedTags = [...new Set(expertiseTags.map((t) => t.trim()).filter(Boolean))].slice(0, 24);
      const prevName = profileQuery.data?.full_name?.trim() ?? "";
      if (fullName.trim() !== prevName) {
        await updateMyProfile(token, { fullName: fullName.trim() || undefined });
      }
      const payload = {
        bio,
        specialty,
        experienceYears,
        hourlyRate,
        expertiseTags: normalizedTags,
      };
      if (meQuery.data?.id) {
        return updateMyTrainerProfile(token, meQuery.data.id, payload);
      }
      return createMyTrainerProfile(token, payload);
    },
    onSuccess: () => {
      setError("");
      setIsEditing(false);
      refreshUserDisplay({ full_name: fullName.trim() || undefined });
      void queryClient.invalidateQueries({ queryKey: ["trainer-me"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });
  const profileUpdateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(token, {
        phone: phone.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
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

  const latestVerification = (verificationQuery.data ?? [])[0];
  const approvedVerification = useMemo(() => {
    const list = verificationQuery.data ?? [];
    const approved = list.filter((v) => v.status === "approved" && v.reviewed_at);
    approved.sort(
      (a, b) => new Date(b.reviewed_at!).getTime() - new Date(a.reviewed_at!).getTime(),
    );
    return approved[0];
  }, [verificationQuery.data]);

  const isVerified = Boolean(meQuery.data?.verified);
  const profileDisplayName = meQuery.data?.profiles?.full_name?.trim() || user?.full_name?.trim() || "Trainer";
  const pageTitle = user?.role === "nutritionist" ? "Nutritionist Profile" : "Trainer Profile";
  const roleLabel = profileQuery.data?.role === "nutritionist" ? "Nutritionist" : "Trainer";
  const titleLine = specialty.trim() || `${roleLabel} · VaultFit`;
  const avatarUrl = meQuery.data?.profiles?.avatar_url ?? "";
  const avatarInitial = profileDisplayName.charAt(0).toUpperCase();
  const normalizedCurrentPhone = phone.trim().replace(/[\s\-()]/g, "");
  const normalizedSavedPhone = (profileQuery.data?.phone ?? "").trim().replace(/[\s\-()]/g, "");
  const phoneAlreadyVerifiedForCurrentInput =
    Boolean(profileQuery.data?.phone_verified) &&
    Boolean(normalizedCurrentPhone) &&
    normalizedCurrentPhone === normalizedSavedPhone;
  const completedBookings = (bookingsQuery.data ?? []).filter((booking) => booking.status === "completed");
  const serviceTitleById = new Map((servicesQuery.data ?? []).map((service) => [service.id, service.title]));
  const planRowsByClientId = new Map<string, { title: string; taskCount: number; createdAt: string }[]>();
  (plansQuery.data ?? []).forEach((plan) => {
    const rows = planRowsByClientId.get(plan.client_id) ?? [];
    rows.push({
      title: plan.title,
      taskCount: countPlanTasks(plan.content),
      createdAt: plan.created_at,
    });
    planRowsByClientId.set(plan.client_id, rows);
  });
  planRowsByClientId.forEach((rows, clientId) => {
    planRowsByClientId.set(
      clientId,
      rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    );
  });

  const completedBookingsSorted = useMemo(() => {
    return [...completedBookings].sort((a, b) => {
      try {
        const da = parseISO(a.booking_date).getTime();
        const db = parseISO(b.booking_date).getTime();
        if (da !== db) return db - da;
      } catch {
        /* keep order */
      }
      return b.start_time.localeCompare(a.start_time);
    });
  }, [completedBookings]);

  const reviews = reviewsQuery.data ?? [];
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const savedExpertiseTags = useMemo(
    () => parseExpertiseTagsFromTrainer(meQuery.data ?? undefined),
    [meQuery.data],
  );

  const upcomingSessionsCount = useMemo(() => {
    const today = startOfDay(new Date());
    return (bookingsQuery.data ?? []).filter((b) => {
      if (b.status !== "pending" && b.status !== "confirmed") return false;
      try {
        const day = startOfDay(parseISO(b.booking_date));
        return !isBefore(day, today);
      } catch {
        return false;
      }
    }).length;
  }, [bookingsQuery.data]);

  const activeServicesCount = useMemo(
    () => (servicesQuery.data ?? []).filter((s) => s.is_active).length,
    [servicesQuery.data],
  );

  const completionBreakdown = useMemo(() => {
    const verifiedTrainer = Boolean(meQuery.data?.verified);
    const verificationStarted = verifiedTrainer || (verificationQuery.data?.length ?? 0) > 0;
    const tagCount = isEditing ? expertiseTags.length : savedExpertiseTags.length;
    const displayNameOk = Boolean(
      (isEditing ? fullName.trim() : profileQuery.data?.full_name?.trim())?.length,
    );
    const items: { done: boolean; label: string }[] = [
      { done: displayNameOk, label: "Display name on account" },
      { done: Boolean(specialty?.trim()), label: "Professional headline" },
      { done: tagCount > 0, label: "At least one expertise tag" },
      { done: (bio?.trim().length ?? 0) >= 40, label: "Bio at least 40 characters" },
      { done: Boolean(avatarUrl), label: "Profile photo" },
      { done: Boolean(profileQuery.data?.phone_verified), label: "Phone number verified" },
      { done: experienceYears > 0 && hourlyRate > 0, label: "Experience & hourly rate set" },
      { done: verificationStarted, label: "Verification submitted or approved" },
    ];
    const doneCount = items.filter((i) => i.done).length;
    return { items, doneCount, total: items.length, pct: Math.round((doneCount / items.length) * 100) };
  }, [
    profileQuery.data?.full_name,
    fullName,
    isEditing,
    profileQuery.data?.phone_verified,
    specialty,
    savedExpertiseTags.length,
    bio,
    avatarUrl,
    experienceYears,
    hourlyRate,
    meQuery.data?.verified,
    verificationQuery.data?.length,
    expertiseTags.length,
  ]);

  const locationLabel = useMemo(() => {
    const tz = profileQuery.data?.timezone?.trim();
    if (!tz) return null;
    return tz.replace(/_/g, " ");
  }, [profileQuery.data?.timezone]);

  const availabilityLines = summarizeAvailability(availabilityQuery.data ?? []);

  function addExpertiseTagFromInput() {
    const next = tagInput.trim();
    if (!next) return;
    setExpertiseTags((prev) => {
      const merged = [...prev, next];
      return [...new Set(merged.map((t) => t.trim()).filter(Boolean))].slice(0, 24);
    });
    setTagInput("");
  }
  const trainerIdForPublic = meQuery.data?.id;

  const handleSharePublicProfile = useCallback(async () => {
    if (!trainerIdForPublic) return;
    const url = publicTrainerProfileUrl(trainerIdForPublic);
    const shareTitle = `${profileDisplayName} · VaultFit`;
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          text: "View my trainer profile on VaultFit.",
          url,
        });
        setShareFeedback(null);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareFeedback("Link copied to clipboard");
      window.setTimeout(() => setShareFeedback(null), 2800);
    } catch {
      setShareFeedback(`Copy blocked — open link: ${url}`);
      window.setTimeout(() => setShareFeedback(null), 8000);
    }
  }, [trainerIdForPublic, profileDisplayName]);

  const verifiedOnLabel = (() => {
    if (!isVerified) return null;
    const raw = approvedVerification?.reviewed_at;
    if (!raw) return null;
    try {
      return format(parseISO(raw), "MMMM d, yyyy");
    } catch {
      return null;
    }
  })();

  return (
    <section className="tprof">
      <header className="tprof-page-head">
        <h1 className="tprof-page-title">{pageTitle}</h1>
        <div className="tprof-page-actions">
          {!isEditing ? (
            <button
              type="button"
              className="tprof-edit-btn"
              onClick={() => {
                setError("");
                setIsEditing(true);
              }}
            >
              <Pencil size={17} aria-hidden />
              {meQuery.data ? "Edit profile" : "Create profile"}
            </button>
          ) : (
            <button
              type="button"
              className="tprof-edit-btn tprof-edit-btn--ghost"
              onClick={() => {
                const d = meQuery.data;
                if (d) {
                  setBio(d.bio ?? "");
                  setSpecialty(d.specialty ?? "");
                  setExperienceYears(d.experience_years ?? 0);
                  setHourlyRate(d.hourly_rate ?? 0);
                  setExpertiseTags(parseExpertiseTagsFromTrainer(d));
                }
                setFullName(profileQuery.data?.full_name?.trim() ?? "");
                setTagInput("");
                setError("");
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </header>

      <div className="tprof-grid">
        <div className="tprof-main">
          {!isEditing ? (
            <>
              {!meQuery.data && !meQuery.isLoading ? (
                <div className="tprof-card tprof-empty">
                  <p className="muted" style={{ margin: 0 }}>
                    You do not have a trainer profile yet. Use <b>Edit profile</b> to add your bio, specialty, and
                    rates, then submit verification.
                  </p>
                </div>
              ) : null}

              {meQuery.data ? (
                <>
                  <article className="tprof-card tprof-hero-card">
                    <div className="tprof-hero-top">
                      <div className="tprof-hero-photo-wrap">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="" className="tprof-hero-photo" />
                        ) : (
                          <div className="tprof-hero-photo tprof-hero-photo--fallback" aria-hidden>
                            {avatarInitial}
                          </div>
                        )}
                      </div>
                      <div className="tprof-hero-text">
                        <div className="tprof-hero-headline">
                          <div>
                            <h2 className="tprof-name">{profileDisplayName}</h2>
                            <p className="tprof-title-line">{titleLine}</p>
                            {locationLabel ? <p className="tprof-location muted">{locationLabel}</p> : null}
                            <div className="tprof-stars" aria-label={avgRating != null ? `Average ${avgRating} of 5` : "No ratings yet"}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={18}
                                  fill={avgRating != null && star <= Math.round(avgRating) ? "currentColor" : "none"}
                                  className={
                                    avgRating != null && star <= Math.round(avgRating) ? "tprof-star-on" : "tprof-star-off"
                                  }
                                />
                              ))}
                              {avgRating != null ? (
                                <span className="tprof-rating-num">{avgRating.toFixed(1)}</span>
                              ) : (
                                <span className="muted tprof-rating-num">New</span>
                              )}
                            </div>
                          </div>
                          {trainerIdForPublic ? (
                            <div className="tprof-social-wrap">
                              <div className="tprof-social" role="group" aria-label="Public profile link">
                                <button
                                  type="button"
                                  className="tprof-social-btn"
                                  onClick={() => void handleSharePublicProfile()}
                                  title="Share your public profile (device share or copy link)"
                                  aria-label="Share public profile link"
                                >
                                  <Share2 size={20} aria-hidden />
                                </button>
                                <a
                                  href={publicTrainerProfileUrl(trainerIdForPublic)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tprof-social-btn"
                                  title="Open how clients see your profile"
                                  aria-label="Open public profile in new tab"
                                >
                                  <Globe size={20} aria-hidden />
                                </a>
                              </div>
                              {shareFeedback ? <p className="tprof-share-feedback">{shareFeedback}</p> : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>

                  <article className="tprof-card">
                    <h3 className="tprof-card-h">Professional bio</h3>
                    <p className="tprof-bio">{bio.trim() || "Add a short bio so clients understand your experience and coaching style."}</p>
                    {experienceYears > 0 ? (
                      <p className="muted tprof-bio-meta">{experienceYears}+ years experience · Hourly from ${hourlyRate} AUD</p>
                    ) : null}
                  </article>

                  <article className="tprof-card">
                    <h3 className="tprof-card-h">Specialties & expertise</h3>
                    <p className="muted tprof-card-sub" style={{ marginTop: "-0.35rem" }}>
                      Tags you add in Edit profile are saved on your trainer profile.
                    </p>
                    <div className="tprof-tags">
                      {savedExpertiseTags.length ? (
                        savedExpertiseTags.map((tag) => (
                          <span key={tag} className="tprof-tag">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No expertise tags yet — add them in Edit profile.</span>
                      )}
                    </div>
                  </article>

                  <article className="tprof-card">
                    <h3 className="tprof-card-h">Credentials & certifications</h3>
                    <ul className="tprof-cred-list">
                      <li className="tprof-cred-row">
                        <div className="tprof-cred-icon" aria-hidden>
                          <GraduationCap size={20} />
                        </div>
                        <div>
                          <p className="tprof-cred-title">Verification credential</p>
                          <p className="muted tprof-cred-desc">
                            {latestVerification
                              ? `Last submitted ${format(parseISO(latestVerification.submitted_at), "MMM d, yyyy")} · status: ${latestVerification.status}`
                              : "No credential upload yet."}
                          </p>
                        </div>
                      </li>
                      <li className="tprof-cred-row">
                        <div className="tprof-cred-icon" aria-hidden>
                          <Award size={20} />
                        </div>
                        <div>
                          <p className="tprof-cred-title">Platform verification</p>
                          <p className="muted tprof-cred-desc">
                            {isVerified
                              ? "Approved by VaultFit compliance review."
                              : "Submit documents on the Verification page for admin review."}
                          </p>
                        </div>
                      </li>
                    </ul>
                    <Link className="tprof-inline-link" to={ROUTES.trainer.verification}>
                      Open verification
                    </Link>
                  </article>

                  <article className="tprof-card tprof-service-history">
                    <div className="tprof-history-header">
                      <div>
                        <h3 className="tprof-card-h">Service history</h3>
                        <p className="muted tprof-card-sub">Completed sessions, newest first. Latest client plan shown when available.</p>
                      </div>
                      <Link to={ROUTES.trainer.bookings} className="tprof-history-bookings-link">
                        All bookings
                      </Link>
                    </div>
                    {bookingsQuery.isLoading || plansQuery.isLoading || servicesQuery.isLoading ? (
                      <p className="muted">Loading…</p>
                    ) : null}
                    {!bookingsQuery.isLoading && completedBookingsSorted.length === 0 ? (
                      <div className="tprof-history-empty">
                        <Calendar size={28} className="muted" aria-hidden />
                        <p className="tprof-history-empty-title">No completed sessions yet</p>
                        <p className="muted tprof-history-empty-text">When clients finish sessions, they will appear here with date, time, and service.</p>
                      </div>
                    ) : (
                      <>
                        <div className="tprof-history-list" role="list">
                          {completedBookingsSorted.slice(0, 25).map((booking) => {
                            const serviceTitle = booking.service_id
                              ? (serviceTitleById.get(booking.service_id) ?? "Session")
                              : "Session";
                            const clientKey = booking.client_id ?? "";
                            const latestPlan = clientKey ? (planRowsByClientId.get(clientKey) ?? [])[0] : undefined;
                            const timeRange = `${booking.start_time.slice(0, 5)}–${booking.end_time.slice(0, 5)}`;
                            return (
                              <div key={booking.id} className="tprof-history-row" role="listitem">
                                <div className="tprof-history-datecol">
                                  <Calendar size={16} className="tprof-history-cal-ic" aria-hidden />
                                  <div>
                                    <p className="tprof-history-date-primary">{formatBookingListDate(booking.booking_date)}</p>
                                    <p className="muted tprof-history-time">{timeRange}</p>
                                  </div>
                                </div>
                                <div className="tprof-history-body">
                                  <div className="tprof-history-title-row">
                                    <h4 className="tprof-history-service">{serviceTitle}</h4>
                                    <span className="tprof-history-badge">Completed</span>
                                  </div>
                                  {latestPlan ? (
                                    <p className="muted tprof-history-plan">
                                      Latest plan: <strong className="tprof-history-plan-name">{latestPlan.title}</strong>
                                      <span className="tprof-history-plan-meta">
                                        {" "}
                                        · {latestPlan.taskCount} task{latestPlan.taskCount === 1 ? "" : "s"}
                                      </span>
                                    </p>
                                  ) : (
                                    <p className="muted tprof-history-plan">No plan on file for this client yet.</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {completedBookingsSorted.length > 25 ? (
                          <p className="muted tprof-history-more">
                            Showing 25 of {completedBookingsSorted.length} completed sessions.{" "}
                            <Link to={ROUTES.trainer.bookings}>Open Bookings</Link> for the full list.
                          </p>
                        ) : null}
                      </>
                    )}
                  </article>

                  <article className="tprof-card">
                    <h3 className="tprof-card-h">Client reviews</h3>
                    {reviewsQuery.isLoading ? <p className="muted">Loading reviews…</p> : null}
                    {!reviewsQuery.isLoading && reviews.length === 0 ? <p className="muted">No reviews yet.</p> : null}
                    <ul className="tprof-compact-list">
                      {reviews.slice(0, 4).map((review) => (
                        <li key={review.id}>
                          <span className="tprof-review-stars">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                size={12}
                                fill={star <= review.rating ? "currentColor" : "none"}
                                className={star <= review.rating ? "tprof-star-on" : "tprof-star-off"}
                              />
                            ))}
                          </span>{" "}
                          {review.comment?.slice(0, 120) || "No comment"}
                          {review.comment && review.comment.length > 120 ? "…" : ""}
                        </li>
                      ))}
                    </ul>
                  </article>
                </>
              ) : null}
            </>
          ) : (
            <div className="tprof-card tprof-edit-card">
              <h3 className="tprof-card-h">{meQuery.data ? "Edit profile" : "Create profile"}</h3>
              <label>Display name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Name shown to clients"
                autoComplete="name"
              />
              <label>Professional headline</label>
              <input
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Strength & conditioning specialist"
              />
              <label>Expertise tags</label>
              <p className="muted" style={{ margin: "0 0 0.4rem", fontSize: "0.82rem" }}>
                Short labels (e.g. hypertrophy, rehab). Press Enter or Add. Max 24 tags.
              </p>
              <div className="tprof-tag-editor">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addExpertiseTagFromInput();
                    }
                  }}
                  placeholder="Type a tag…"
                  maxLength={100}
                />
                <button type="button" className="secondary-btn" onClick={addExpertiseTagFromInput}>
                  Add
                </button>
              </div>
              <div className="tprof-tag-chips">
                {expertiseTags.map((tag) => (
                  <span key={tag} className="tprof-tag tprof-tag--removable">
                    {tag}
                    <button
                      type="button"
                      className="tprof-tag-remove"
                      aria-label={`Remove ${tag}`}
                      onClick={() => setExpertiseTags((prev) => prev.filter((t) => t !== tag))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <label>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={5}
                placeholder="Describe your experience, certifications, and how you coach clients."
              />
              <label>Experience (years)</label>
              <input
                type="number"
                min={0}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value || 0))}
              />
              <label>Hourly rate (AUD)</label>
              <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value || 0))} />
              <label>Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61…" />
              <div className="phone-otp-row">
                <button
                  className="secondary-btn otp-btn-sm"
                  type="button"
                  disabled={!phone.trim() || profileUpdateMutation.isPending}
                  onClick={() => profileUpdateMutation.mutate()}
                >
                  {profileUpdateMutation.isPending ? "Saving phone…" : "Save phone"}
                </button>
                <button
                  className="secondary-btn otp-btn-sm"
                  type="button"
                  disabled={!phone.trim() || sendOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
                  onClick={() => sendOtpMutation.mutate()}
                >
                  {sendOtpMutation.isPending
                    ? "Sending OTP…"
                    : phoneAlreadyVerifiedForCurrentInput
                      ? "Verified"
                      : "Send OTP"}
                </button>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit OTP"
                  maxLength={6}
                  className="otp-code-input"
                />
                <button
                  className="secondary-btn otp-btn-sm"
                  type="button"
                  disabled={otpCode.trim().length !== 6 || verifyOtpMutation.isPending || phoneAlreadyVerifiedForCurrentInput}
                  onClick={() => verifyOtpMutation.mutate()}
                >
                  {verifyOtpMutation.isPending ? "Verifying…" : "Verify OTP"}
                </button>
              </div>
              {phoneAlreadyVerifiedForCurrentInput ? (
                <p className="muted">Phone matches your verified number. Change the number and save before a new OTP.</p>
              ) : null}
              {otpStatus ? <p className="muted">{otpStatus}</p> : null}
              {otpPreview ? <p className="muted">Dev OTP: {otpPreview}</p> : null}
              <div className="tprof-form-actions">
                <button className="primary-btn" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : meQuery.data ? "Save changes" : "Create profile"}
                </button>
              </div>
              {error ? <p className="error">{error}</p> : null}
            </div>
          )}
        </div>

        <aside className="tprof-aside">
          <article className="tprof-card tprof-side-card tprof-verify-card">
            <div className="tprof-verify-icon" aria-hidden>
              <CheckCircle2 size={36} strokeWidth={2} />
            </div>
            {isVerified ? (
              <>
                <p className="tprof-verify-status">Approved {roleLabel.toLowerCase()}</p>
                {verifiedOnLabel ? <p className="muted tprof-verify-date">Verified on {verifiedOnLabel}</p> : null}
                <p className="muted tprof-verify-foot">
                  Your identity and professional certifications have been verified by our compliance team.
                </p>
              </>
            ) : (
              <>
                <p className="tprof-verify-status tprof-verify-status--pending">Verification required</p>
                <p className="muted tprof-verify-foot">
                  Complete your profile and submit documents. Our team will review and approve your account.
                </p>
                <Link className="primary-btn tprof-verify-cta" to={ROUTES.trainer.verification}>
                  Go to verification
                </Link>
              </>
            )}
          </article>

          <article className="tprof-card tprof-side-card">
            <h3 className="tprof-card-h">Availability</h3>
            {availabilityQuery.isLoading ? <p className="muted">Loading hours…</p> : null}
            {!primaryServiceId ? (
              <p className="muted">Create a service first, then set weekly hours under Services.</p>
            ) : availabilityLines.length === 0 && !availabilityQuery.isLoading ? (
              <p className="muted">No weekly slots yet. Add availability for your primary service.</p>
            ) : (
              <ul className="tprof-hours">
                {availabilityLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <div className="tprof-aside-btns">
              <Link to={ROUTES.trainer.servicesSchedule} className="secondary-btn tprof-manage-cal">
                Manage calendar
              </Link>
              {!primaryServiceId ? (
                <Link to={ROUTES.trainer.services} className="secondary-btn tprof-manage-cal">
                  Set up services
                </Link>
              ) : null}
            </div>
          </article>

          <article className="tprof-card tprof-side-card">
            <h3 className="tprof-card-h">Profile checklist</h3>
            <p className="muted tprof-checklist-intro">
              Each item is a real requirement we check from your account. {completionBreakdown.doneCount} of{" "}
              {completionBreakdown.total} complete.
            </p>
            <ul className="tprof-checklist">
              {completionBreakdown.items.map((item) => (
                <li key={item.label} className={item.done ? "tprof-checklist-done" : ""}>
                  <span className="tprof-check-mark" aria-hidden>
                    {item.done ? "✓" : "○"}
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
            <div className="tprof-bar-track">
              <div className="tprof-bar-fill" style={{ width: `${completionBreakdown.pct}%` }} />
            </div>
            <p className="tprof-perf-pct">{completionBreakdown.pct}%</p>
            <button type="button" className="tprof-linkish" onClick={() => setIsEditing(true)}>
              Update profile fields
            </button>

            <h3 className="tprof-card-h tprof-activity-h">Activity (live)</h3>
            <p className="muted tprof-activity-caption">Counts from your bookings, plans, and services in VaultFit.</p>
            <div className="tprof-perf-stats tprof-perf-stats--four">
              <div>
                <p className="tperf-big">{(plansQuery.data ?? []).length}</p>
                <p className="muted tperf-sub">Client plans</p>
              </div>
              <div>
                <p className="tperf-big">{completedBookings.length}</p>
                <p className="muted tperf-sub">Completed sessions</p>
              </div>
              <div>
                <p className="tperf-big">{upcomingSessionsCount}</p>
                <p className="muted tperf-sub">Upcoming sessions</p>
              </div>
              <div>
                <p className="tperf-big">{activeServicesCount}</p>
                <p className="muted tperf-sub">Active services</p>
              </div>
            </div>
            <div className="tprof-aside-links">
              <Link to={ROUTES.trainer.plans}>Manage plans</Link>
              <Link to={ROUTES.trainer.bookings}>View bookings</Link>
            </div>
          </article>
        </aside>
      </div>

      <style>{`
        .tprof {
          max-width: 1120px;
          margin: 0 auto;
        }
        .tprof-page-head {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .tprof-page-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .tprof-edit-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.88rem;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
          cursor: pointer;
        }
        .tprof-edit-btn:hover {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(129, 140, 248, 0.45);
        }
        .tprof-edit-btn--ghost {
          background: transparent;
        }
        .tprof-grid {
          display: grid;
          grid-template-columns: 1fr min(320px, 34%);
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .tprof-grid {
            grid-template-columns: 1fr;
          }
        }
        .tprof-card {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: 16px;
          padding: 1.25rem 1.35rem;
          margin-bottom: 1rem;
        }
        .tprof-card-h {
          margin: 0 0 0.65rem;
          font-size: 1rem;
          font-weight: 700;
        }
        .tprof-card-sub {
          margin: 0 0 0.75rem;
          font-size: 0.88rem;
        }
        .tprof-hero-card {
          padding: 1.35rem 1.5rem;
        }
        .tprof-hero-top {
          display: flex;
          gap: 1.25rem;
          flex-wrap: wrap;
        }
        .tprof-hero-photo-wrap {
          flex-shrink: 0;
        }
        .tprof-hero-photo {
          width: 168px;
          height: 168px;
          border-radius: 18px;
          object-fit: cover;
          border: 2px solid rgba(52, 211, 153, 0.35);
          display: block;
        }
        .tprof-hero-photo--fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #22c55e, #0ea5e9);
          color: #fff;
          font-weight: 900;
          font-size: 3rem;
        }
        .tprof-hero-text {
          flex: 1;
          min-width: 200px;
        }
        .tprof-hero-headline {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }
        .tprof-name {
          margin: 0 0 0.25rem;
          font-size: 1.65rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .tprof-title-line {
          margin: 0 0 0.35rem;
          font-size: 1rem;
          color: var(--text-secondary);
          font-weight: 600;
        }
        .tprof-location {
          margin: 0 0 0.65rem;
          font-size: 0.9rem;
        }
        .tprof-stars {
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }
        .tprof-star-on {
          color: #fbbf24;
        }
        .tprof-star-off {
          color: #475569;
        }
        .tprof-rating-num {
          margin-left: 0.45rem;
          font-weight: 800;
          font-size: 0.95rem;
        }
        .tprof-social-wrap {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          max-width: 12rem;
        }
        .tprof-social {
          display: flex;
          gap: 0.4rem;
        }
        .tprof-social-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          cursor: pointer;
          text-decoration: none;
          padding: 0;
        }
        .tprof-social-btn:hover {
          color: #fff;
          border-color: rgba(129, 140, 248, 0.45);
          background: rgba(99, 102, 241, 0.15);
        }
        .tprof-share-feedback {
          margin: 0;
          font-size: 0.72rem;
          line-height: 1.3;
          color: #86efac;
          text-align: right;
          word-break: break-word;
        }
        .tprof-bio {
          margin: 0;
          line-height: 1.6;
          color: var(--text-secondary);
          font-size: 0.95rem;
        }
        .tprof-bio-meta {
          margin: 0.75rem 0 0;
          font-size: 0.85rem;
        }
        .tprof-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }
        .tprof-tag {
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
          background: rgba(34, 197, 94, 0.12);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.35);
        }
        .tprof-cred-list {
          list-style: none;
          margin: 0 0 0.75rem;
          padding: 0;
        }
        .tprof-cred-row {
          display: flex;
          gap: 0.85rem;
          padding: 0.65rem 0;
          border-bottom: 1px solid var(--border-light);
        }
        .tprof-cred-row:last-of-type {
          border-bottom: none;
        }
        .tprof-cred-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #38bdf8;
          flex-shrink: 0;
        }
        .tprof-cred-title {
          margin: 0 0 0.2rem;
          font-weight: 700;
          font-size: 0.92rem;
        }
        .tprof-cred-desc {
          margin: 0;
          font-size: 0.82rem;
        }
        .tprof-inline-link {
          font-weight: 600;
          font-size: 0.88rem;
        }
        .tprof-history-header {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem 1rem;
          margin-bottom: 0.65rem;
        }
        .tprof-history-bookings-link {
          font-size: 0.86rem;
          font-weight: 700;
          text-decoration: none;
          color: #7dd3fc;
          padding: 0.35rem 0.65rem;
          border-radius: 8px;
          border: 1px solid rgba(56, 189, 248, 0.35);
          background: rgba(56, 189, 248, 0.08);
          white-space: nowrap;
        }
        .tprof-history-bookings-link:hover {
          background: rgba(56, 189, 248, 0.15);
          color: #bae6fd;
        }
        .tprof-history-empty {
          text-align: center;
          padding: 1.75rem 1rem;
          border: 1px dashed var(--border-light);
          border-radius: 14px;
          background: rgba(0, 0, 0, 0.12);
        }
        .tprof-history-empty-title {
          margin: 0.5rem 0 0.25rem;
          font-weight: 700;
          font-size: 1rem;
        }
        .tprof-history-empty-text {
          margin: 0;
          font-size: 0.88rem;
          max-width: 26rem;
          margin-left: auto;
          margin-right: auto;
        }
        .tprof-history-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          max-height: 28rem;
          overflow-y: auto;
          padding: 0.15rem 0.35rem 0.15rem 0;
          margin-top: 0.35rem;
        }
        .tprof-history-row {
          display: grid;
          grid-template-columns: minmax(0, 9.5rem) minmax(0, 1fr);
          gap: 0.65rem 1rem;
          padding: 0.9rem 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.03);
          align-items: start;
        }
        @media (max-width: 560px) {
          .tprof-history-row {
            grid-template-columns: 1fr;
          }
          .tprof-history-datecol {
            flex-direction: row;
            align-items: center;
            text-align: left;
          }
        }
        .tprof-history-datecol {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
          min-width: 0;
        }
        .tprof-history-cal-ic {
          color: #38bdf8;
          flex-shrink: 0;
          margin-top: 0.15rem;
        }
        .tprof-history-date-primary {
          margin: 0;
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1.25;
          color: var(--text-primary);
        }
        .tprof-history-time {
          margin: 0.15rem 0 0;
          font-size: 0.72rem;
          font-weight: 600;
        }
        .tprof-history-body {
          min-width: 0;
        }
        .tprof-history-title-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.45rem 0.65rem;
        }
        .tprof-history-service {
          margin: 0;
          font-size: 1rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .tprof-history-badge {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.2rem 0.45rem;
          border-radius: 6px;
          background: rgba(52, 211, 153, 0.15);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.35);
        }
        .tprof-history-plan {
          margin: 0.45rem 0 0;
          font-size: 0.84rem;
          line-height: 1.45;
        }
        .tprof-history-plan-name {
          color: var(--text-primary);
          font-weight: 700;
        }
        .tprof-history-plan-meta {
          font-weight: 500;
        }
        .tprof-history-more {
          margin: 0.75rem 0 0;
          font-size: 0.82rem;
        }
        .tprof-history-more a {
          font-weight: 700;
          color: #7dd3fc;
        }
        .tprof-compact-list {
          margin: 0;
          padding-left: 1.1rem;
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.55;
        }
        .tprof-review-stars {
          display: inline-flex;
          gap: 0.05rem;
          vertical-align: middle;
          margin-right: 0.25rem;
        }
        .tprof-edit-card label {
          display: block;
          margin-top: 0.75rem;
          margin-bottom: 0.25rem;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .tprof-form-actions {
          margin-top: 1rem;
        }
        .tprof-aside .tprof-card {
          margin-bottom: 1rem;
        }
        .tprof-side-card {
          padding: 1.15rem 1.2rem;
        }
        .tprof-verify-card {
          text-align: center;
          border-color: rgba(52, 211, 153, 0.25);
          background: linear-gradient(165deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.4));
        }
        .tprof-verify-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 0.75rem;
          border-radius: 50%;
          background: rgba(52, 211, 153, 0.2);
          color: #4ade80;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .tprof-verify-status {
          margin: 0 0 0.35rem;
          font-size: 0.78rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #4ade80;
        }
        .tprof-verify-status--pending {
          color: #fbbf24;
        }
        .tprof-verify-date {
          margin: 0 0 0.65rem;
          font-size: 0.85rem;
        }
        .tprof-verify-foot {
          margin: 0;
          font-size: 0.78rem;
          line-height: 1.45;
          text-align: left;
        }
        .tprof-verify-cta {
          margin-top: 0.85rem;
          display: inline-flex;
          justify-content: center;
          text-decoration: none;
        }
        .tprof-hours {
          margin: 0 0 0.85rem;
          padding: 0;
          list-style: none;
          font-size: 0.88rem;
          color: var(--text-secondary);
          line-height: 1.5;
        }
        .tprof-manage-cal {
          width: 100%;
          text-align: center;
          text-decoration: none;
          display: block;
          box-sizing: border-box;
        }
        .tprof-perf-label {
          margin: 0 0 0.35rem;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .tprof-bar-track {
          height: 8px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          overflow: hidden;
        }
        .tprof-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #22c55e, #38bdf8);
        }
        .tprof-perf-pct {
          margin: 0.35rem 0 0.85rem;
          font-weight: 800;
          font-size: 1.1rem;
        }
        .tprof-perf-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }
        .tperf-big {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .tperf-sub {
          margin: 0.15rem 0 0;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tprof-perf-stats--four {
          grid-template-columns: 1fr 1fr;
          gap: 0.65rem 0.75rem;
        }
        .tprof-activity-h {
          margin-top: 1.15rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-light);
        }
        .tprof-activity-caption {
          margin: 0 0 0.75rem;
          font-size: 0.82rem;
        }
        .tprof-aside-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem 1rem;
          margin-top: 0.85rem;
          font-size: 0.86rem;
          font-weight: 600;
        }
        .tprof-aside-links a {
          color: #7dd3fc;
        }
        .tprof-aside-btns {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.65rem;
        }
        .tprof-checklist-intro {
          margin: 0 0 0.55rem;
          font-size: 0.82rem;
          line-height: 1.45;
        }
        .tprof-checklist {
          list-style: none;
          margin: 0 0 0.75rem;
          padding: 0;
          font-size: 0.8rem;
          line-height: 1.45;
          color: var(--text-secondary);
        }
        .tprof-checklist li {
          display: flex;
          gap: 0.45rem;
          align-items: flex-start;
          margin-bottom: 0.35rem;
        }
        .tprof-checklist-done {
          color: #86efac;
        }
        .tprof-check-mark {
          flex-shrink: 0;
          width: 1rem;
          font-weight: 800;
        }
        .tprof-linkish {
          margin: 0 0 0.25rem;
          padding: 0;
          border: none;
          background: none;
          color: #7dd3fc;
          font-weight: 600;
          font-size: 0.86rem;
          cursor: pointer;
          text-decoration: underline;
        }
        .tprof-tag-editor {
          display: flex;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-bottom: 0.5rem;
        }
        .tprof-tag-editor input {
          flex: 1;
          min-width: 160px;
        }
        .tprof-tag-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-bottom: 0.35rem;
        }
        .tprof-tag--removable {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding-right: 0.35rem;
        }
        .tprof-tag-remove {
          border: none;
          background: rgba(0, 0, 0, 0.2);
          color: inherit;
          width: 1.35rem;
          height: 1.35rem;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          line-height: 1;
          padding: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .tprof-tag-remove:hover {
          background: rgba(239, 68, 68, 0.25);
        }
        .tprof-empty {
          padding: 1.5rem;
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

function countPlanTasks(content: unknown): number {
  if (!content || typeof content !== "object") return 0;
  const maybe = content as { weeks?: Array<{ days?: unknown[] }> };
  if (!Array.isArray(maybe.weeks)) return 0;
  return maybe.weeks.reduce((total, week) => total + (Array.isArray(week.days) ? week.days.length : 0), 0);
}
