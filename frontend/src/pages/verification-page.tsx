import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { submitVerificationDocument } from "../services/verification";
import { useAuth } from "../state/auth-context";

export function VerificationPage() {
  const { token, user } = useAuth();
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [credentialUrl, setCredentialUrl] = useState("");
  const [identityUrl, setIdentityUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSubmit = user?.role === "trainer";

  const submitMutation = useMutation({
    mutationFn: () => {
      const hasCredential = Boolean(credentialFile || credentialUrl.trim());
      const hasIdentity = Boolean(identityFile || identityUrl.trim());
      if (!hasCredential || !hasIdentity) {
        throw new Error("Provide credential and identity documents (either URL or file for each).");
      }
      return submitVerificationDocument(token, {
        credentialFile: credentialFile ?? undefined,
        identityFile: identityFile ?? undefined,
        credentialUrl: credentialUrl.trim() || undefined,
        identityUrl: identityUrl.trim() || undefined,
        notes,
      });
    },
    onSuccess: (data) => {
      setError("");
      setCredentialFile(null);
      setIdentityFile(null);
      setCredentialUrl("");
      setIdentityUrl("");
      setMessage(`Verification request submitted: ${data.id} (${data.status})`);
    },
    onError: (e) => setError((e as Error).message),
  });

  return (
    <section>
      <h2>Verification</h2>
      <div className="card">
        <h3>Submit Verification Request</h3>
        <p className="muted">
          Upload or paste URLs for both required docs: credential proof and personal identity. You can provide URL, file, or both.
        </p>
        <label>Credential document URL (optional)</label>
        <input
          value={credentialUrl}
          onChange={(e) => setCredentialUrl(e.target.value)}
          placeholder="https://... or storage://..."
        />
        <label>Credential document file (optional)</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          onChange={(e) => setCredentialFile(e.target.files?.[0] ?? null)}
        />
        {credentialFile ? <p className="muted">Selected: {credentialFile.name}</p> : null}
        <label>Identity document URL (optional)</label>
        <input
          value={identityUrl}
          onChange={(e) => setIdentityUrl(e.target.value)}
          placeholder="https://... or storage://..."
        />
        <label>Identity document file (optional)</label>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
          onChange={(e) => setIdentityFile(e.target.files?.[0] ?? null)}
        />
        {identityFile ? <p className="muted">Selected: {identityFile.name}</p> : null}
        <label>Notes</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} />
        <button
          className="primary-btn"
          disabled={
            !canSubmit ||
            !(credentialFile || credentialUrl.trim()) ||
            !(identityFile || identityUrl.trim()) ||
            submitMutation.isPending
          }
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
