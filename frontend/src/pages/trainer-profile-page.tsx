import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import { getMyProfile, sendPhoneOtp, updateMyProfile, verifyPhoneOtp } from "../services/profiles";
import { getTrainerReviews } from "../services/reviews";
import { createMyTrainerProfile, getMyTrainerProfile, updateMyTrainerProfile } from "../services/trainers";
import { getMyVerificationRequests } from "../services/verification";
import { useAuth } from "../state/auth-context";

export function TrainerProfilePage() {
  const { token } = useAuth();
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

  useEffect(() => {
    const me = meQuery.data;
    if (!me) return;
    setBio(me.bio ?? "");
    setSpecialty(me.specialty ?? "");
    setExperienceYears(me.experience_years ?? 0);
    setHourlyRate(me.hourly_rate ?? 0);
  }, [meQuery.data]);
  useEffect(() => {
    setPhone(profileQuery.data?.phone ?? "");
  }, [profileQuery.data?.phone]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { bio, specialty, experienceYears, hourlyRate };
      if (meQuery.data?.id) {
        return updateMyTrainerProfile(token, meQuery.data.id, payload);
      }
      return createMyTrainerProfile(token, payload);
    },
    onSuccess: () => {
      setError("");
      setIsEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["trainer-me"] });
      void queryClient.invalidateQueries({ queryKey: ["trainers"] });
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
  const isVerified = Boolean(meQuery.data?.verified);
  const profileDisplayName = meQuery.data?.profiles?.full_name?.trim() || "My profile";
  const roleLabel =
    (meQuery.data?.specialty ?? "").toLowerCase().includes("nutri") ? "Nutritionist" : "Trainer";
  const avatarUrl = meQuery.data?.profiles?.avatar_url ?? "";
  const avatarInitial = profileDisplayName.charAt(0).toUpperCase();
  const normalizedCurrentPhone = phone.trim().replace(/[\s\-()]/g, "");
  const normalizedSavedPhone = (profileQuery.data?.phone ?? "").trim().replace(/[\s\-()]/g, "");
  const phoneAlreadyVerifiedForCurrentInput =
    Boolean(profileQuery.data?.phone_verified) &&
    Boolean(normalizedCurrentPhone) &&
    normalizedCurrentPhone === normalizedSavedPhone;

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
      <p className="muted">Complete your trainer or nutritionist profile and submit verification to unlock platform features.</p>

      <div className="card">
        <h3>Verification status</h3>
        {meQuery.isLoading ? <p>Loading profile...</p> : null}
        {!meQuery.isLoading && !meQuery.data ? <p className="muted">No profile yet. Create it below, then submit verification.</p> : null}
        {meQuery.data ? (
          <p>
            Profile status:{" "}
            <span className={isVerified ? "badge badge-success" : "badge badge-muted"}>
              {isVerified ? "Verified" : "Not verified"}
            </span>
          </p>
        ) : null}
        {latestVerification ? (
          <p className="muted">
            Latest verification request: <b className={`status status-${latestVerification.status}`}>{latestVerification.status}</b> (
            {new Date(latestVerification.submitted_at).toLocaleString()})
          </p>
        ) : (
          <p className="muted">No verification request submitted yet.</p>
        )}
        <Link className="secondary-link" to={ROUTES.trainer.verification}>
          Open verification submission
        </Link>
      </div>

      <div className="card profile-details-card">
        <h3>{meQuery.data ? "Profile details" : "Create profile"}</h3>
        {!isEditing && meQuery.data ? (
          <>
            <div className="profile-view-grid">
              <article className="profile-view-item">
                <p className="profile-view-label">Role</p>
                <p className="profile-view-value">{roleLabel}</p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Specialty</p>
                <p className="profile-view-value">{specialty || "Not set"}</p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Experience</p>
                <p className="profile-view-value">{experienceYears} years</p>
              </article>
              <article className="profile-view-item">
                <p className="profile-view-label">Hourly rate</p>
                <p className="profile-view-value">${hourlyRate}</p>
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
            </div>
            <p className="muted">
              <b>Bio:</b> {bio || "Not set"}
            </p>
            <button className="primary-btn" onClick={() => setIsEditing(true)}>
              Edit profile
            </button>
          </>
        ) : (
          <>
            <label>Specialty</label>
            <input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="strength, nutritionist, rehab..." />
            <label>Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} placeholder="Describe your experience and approach" />
            <label>Experience years</label>
            <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value || 0))} />
            <label>Hourly rate (AUD)</label>
            <input type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(Number(e.target.value || 0))} />
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61..." />
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
              <button
                className="secondary-btn"
                type="button"
                disabled={!phone.trim() || profileUpdateMutation.isPending}
                onClick={() => profileUpdateMutation.mutate()}
              >
                {profileUpdateMutation.isPending ? "Saving phone..." : "Save phone"}
              </button>
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
                style={{ maxWidth: 180 }}
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
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="primary-btn" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : meQuery.data ? "Save changes" : "Create profile"}
              </button>
              {meQuery.data ? (
                <button
                  className="secondary-btn"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setError("");
                    setBio(meQuery.data.bio ?? "");
                    setSpecialty(meQuery.data.specialty ?? "");
                    setExperienceYears(meQuery.data.experience_years ?? 0);
                    setHourlyRate(meQuery.data.hourly_rate ?? 0);
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </>
        )}
        {error ? <p className="error">{error}</p> : null}
      </div>

      <div className="card">
        <h3>Client reviews</h3>
        <p className="muted">Feedback from clients on completed bookings.</p>
        {reviewsQuery.isLoading ? <p>Loading reviews...</p> : null}
        {!reviewsQuery.isLoading && (reviewsQuery.data ?? []).length === 0 ? (
          <p className="muted">No client reviews yet.</p>
        ) : null}
        <ul className="list">
          {(reviewsQuery.data ?? []).map((review) => (
            <li key={review.id}>
              <span>
                <span style={{ display: "inline-flex", gap: "0.1rem", verticalAlign: "middle", marginRight: "0.3rem" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={14}
                      fill={star <= review.rating ? "currentColor" : "none"}
                      style={{ color: star <= review.rating ? "#f59e0b" : "#64748b" }}
                    />
                  ))}
                </span>
                ({review.rating}/5) - {review.comment ?? "No comment"}
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

