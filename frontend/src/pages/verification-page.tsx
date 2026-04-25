import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { submitVerificationDocument } from "../services/verification";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import { ShieldCheck, AlertCircle, FilePlus } from "lucide-react";
import { Link } from "react-router-dom";
import { ROUTES } from "../lib/navigation";
import toast from "react-hot-toast";

export function VerificationPage() {
  const { token, user } = useAuth();
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  const isTrainerRole = user?.role === "trainer" || user?.role === "nutritionist";

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: isTrainerRole,
  });

  const trainerProfileCreated = meQuery.isSuccess && !!meQuery.data;
  const isAlreadyVerified = Boolean(meQuery.data?.verified);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!credentialFile || !identityFile) {
        throw new Error("Please upload both identity and credential documents.");
      }
      return submitVerificationDocument(token, {
        credentialFile,
        identityFile,
        notes,
      });
    },
    onSuccess: () => {
      toast.success("Verification request submitted successfully!");
      setCredentialFile(null);
      setIdentityFile(null);
      setNotes("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!isTrainerRole) {
    return (
      <section>
        <div className="card glass-card empty-state">
          <AlertCircle size={48} className="text-warning mb-4" />
          <h2 className="mb-2">Restricted Access</h2>
          <p className="muted">Only trainers and nutritionists can access the verification portal.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={32} className="text-primary" />
        <div>
          <h2 className="m-0 mb-1">Get Verified</h2>
          <p className="muted m-0">Submit your credentials and ID to start booking clients.</p>
        </div>
      </div>

      {!trainerProfileCreated && !meQuery.isLoading && (
         <div className="card glass-card border-warning bg-warning-light mb-6">
           <h3 className="flex items-center gap-2 text-warning m-0 mb-2">
             <AlertCircle size={20} /> Action Required: Missing Public Profile
           </h3>
           <p className="m-0 mb-4">You need to set up your public Trainer Profile before you can submit verification documents.</p>
           <Link to={ROUTES.trainer.profile} className="primary-btn max-w-sm">Create Profile Now</Link>
         </div>
      )}
      {trainerProfileCreated && isAlreadyVerified ? (
        <div className="card glass-card border-success mb-6">
          <h3 className="m-0 mb-2">Already verified</h3>
          <p className="m-0">Your documents are already approved. You do not need to submit verification again.</p>
        </div>
      ) : null}

      <div className={`card glass-card ${!trainerProfileCreated || isAlreadyVerified ? "opacity-50 pointer-events-none" : ""}`}>
        <h3>Upload Documents</h3>
        <p className="muted mb-6">
          Please upload clear copies of your professional certification and a valid government ID.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="file-upload-box">
            <label className="block font-medium mb-2">Professional Credential</label>
            <div className="upload-area">
              <FilePlus size={24} className="muted mb-2" />
              <p className="text-sm m-0 mb-4 text-center">Upload PDF, JPG, or PNG</p>
              <input
                type="file"
                className="w-full"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setCredentialFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {credentialFile && <p className="text-sm text-success mt-2 font-medium">Selected: {credentialFile.name}</p>}
          </div>

          <div className="file-upload-box">
            <label className="block font-medium mb-2">Government ID</label>
            <div className="upload-area">
              <FilePlus size={24} className="muted mb-2" />
              <p className="text-sm m-0 mb-4 text-center">Upload PDF, JPG, or PNG</p>
              <input
                type="file"
                className="w-full"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => setIdentityFile(e.target.files?.[0] ?? null)}
              />
            </div>
            {identityFile && <p className="text-sm text-success mt-2 font-medium">Selected: {identityFile.name}</p>}
          </div>
        </div>

        <div className="mb-6">
          <label className="block font-medium mb-2">Additional Notes for Reviewers</label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            rows={3} 
            className="w-full"
            placeholder="Explain any name changes, relevant background context, etc."
          />
        </div>

        <button
          className="primary-btn w-full max-w-sm"
          disabled={!trainerProfileCreated || isAlreadyVerified || !credentialFile || !identityFile || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending ? "Uploading Securely..." : "Submit for Verification"}
        </button>
      </div>

      <style>{`
        .max-w-3xl { max-width: 48rem; }
        .mx-auto { margin-left: auto; margin-right: auto; }
        .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        @media (min-width: 768px) { .md\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .gap-6 { gap: 1.5rem; }
        .opacity-50 { opacity: 0.5; }
        .pointer-events-none { pointer-events: none; }
        .bg-warning-light { background: rgba(245, 158, 11, 0.05); }
        .upload-area { border: 2px dashed var(--border-light); padding: 2rem 1rem; border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.2); transition: border-color 0.2s; }
        .upload-area:hover { border-color: var(--primary); }
      `}</style>
    </section>
  );
}
