import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile } from "../services/profiles";
import { useAuth } from "../state/auth-context";

export function ClientProfilePage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");

  const profileQuery = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => getMyProfile(token),
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name ?? "");
    setPhone(profileQuery.data.phone ?? "");
    setTimezone(profileQuery.data.timezone ?? "");
    setAvatarUrl(profileQuery.data.avatar_url ?? "");
  }, [profileQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateMyProfile(token, {
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        timezone: timezone.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      }),
    onSuccess: () => {
      setError("");
      void queryClient.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>My profile</h2>
      <p className="muted">View and update your account profile details.</p>

      <div className="card">
        <h3>Profile details</h3>
        {profileQuery.isLoading ? <p>Loading profile...</p> : null}
        {profileQuery.data ? (
          <p className="muted">
            Role: <b>{profileQuery.data.role}</b>
          </p>
        ) : null}

        <label>Full name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />

        <label>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+61..." />

        <label>Timezone</label>
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Australia/Melbourne" />

        <label>Avatar URL</label>
        <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />

        <button className="primary-btn" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          {updateMutation.isPending ? "Saving..." : "Update profile"}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
