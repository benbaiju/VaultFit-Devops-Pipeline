import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { submitVerificationRequest } from "../services/verification";
import { useAuth } from "../state/auth-context";

export function VerificationPage() {
  const { token, user } = useAuth();
  const [credentialUrl, setCredentialUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSubmit = user?.role === "trainer";

  const submitMutation = useMutation({
    mutationFn: () => submitVerificationRequest(token, { credentialUrl, notes }),
    onSuccess: (data) => {
      setError("");
      setMessage(`Verification request submitted: ${data.id} (${data.status})`);
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>Verification</h2>
      <div className="card">
        <h3>Submit Verification Request</h3>
        <p className="muted">Only trainer accounts can submit verification documents.</p>
        <label>Credential document URL</label>
        <input
          value={credentialUrl}
          onChange={(e) => setCredentialUrl(e.target.value)}
          placeholder="storage/credential-docs/file.pdf"
        />
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        <button
          className="primary-btn"
          disabled={!canSubmit || !credentialUrl || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Submitting..." : "Submit request"}
        </button>
        {!canSubmit ? <p className="error">Current role is not trainer.</p> : null}
        {message ? <p className="muted">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
    </section>
  );
}
