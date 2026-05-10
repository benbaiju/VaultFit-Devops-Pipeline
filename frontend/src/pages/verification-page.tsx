import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  submitVerificationDocument,
  getMyVerificationRequests,
  getVerificationDocumentUrlByType,
} from "../services/verification";
import { getMyTrainerProfile } from "../services/trainers";
import { useAuth } from "../state/auth-context";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  FilePlus,
  Filter,
  MessageCircle,
  Pencil,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ROUTES } from "../lib/navigation";
import toast from "react-hot-toast";

type StepVisual = "done" | "current" | "upcoming";
type DocSlot = "credential" | "identity";

function fileKindFromName(name: string): string {
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

function displayNameFromStorageRef(ref: string | null | undefined): string {
  if (!ref?.trim()) return "";
  const r = ref.trim();
  if (r.startsWith("storage://")) {
    const path = r.replace(/^storage:\/\/[^/]+\//, "");
    const base = path.split("/").pop() ?? "";
    const cleaned = base.replace(/^\d+-/, "");
    return cleaned || "Stored document";
  }
  try {
    const u = new URL(r);
    const seg = u.pathname.split("/").filter(Boolean).pop();
    return seg || "Linked document";
  } catch {
    return "Document";
  }
}

export function VerificationPage() {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [identityFile, setIdentityFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<DocSlot | null>(null);
  const [docSearch, setDocSearch] = useState("");
  const [docFilter, setDocFilter] = useState<"all" | "needs" | "staged">("all");
  const credentialInputRef = useRef<HTMLInputElement>(null);
  const identityInputRef = useRef<HTMLInputElement>(null);

  const isTrainerRole = user?.role === "trainer" || user?.role === "nutritionist";

  const meQuery = useQuery({
    queryKey: ["trainer-me"],
    queryFn: () => getMyTrainerProfile(token),
    enabled: isTrainerRole,
  });

  const verificationQuery = useQuery({
    queryKey: ["trainer-verification-requests"],
    queryFn: () => getMyVerificationRequests(token),
    enabled: isTrainerRole,
  });

  const trainerProfileCreated = meQuery.isSuccess && !!meQuery.data;
  const isAlreadyVerified = Boolean(meQuery.data?.verified);

  const latestRequest = useMemo(() => {
    const list = [...(verificationQuery.data ?? [])].sort(
      (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime(),
    );
    return list[0] ?? null;
  }, [verificationQuery.data]);

  const hasSubmission = Boolean(latestRequest);
  const pendingReview = latestRequest?.status === "pending";
  const wasRejected = latestRequest?.status === "rejected";
  const wasApproved = latestRequest?.status === "approved";

  const headerStatus = (() => {
    if (isAlreadyVerified) return { label: "Verified", tone: "ok" as const };
    if (pendingReview) return { label: "Verification pending", tone: "wait" as const };
    if (wasRejected) return { label: "Rejected — resubmit", tone: "bad" as const };
    if (wasApproved && !isAlreadyVerified) return { label: "Approved — finalizing", tone: "wait" as const };
    if (hasSubmission) return { label: "Submitted", tone: "wait" as const };
    return { label: "Not submitted", tone: "muted" as const };
  })();

  const steps = useMemo(() => {
    const step1Detail =
      wasRejected && hasSubmission
        ? "Documents on file — upload new files below"
        : hasSubmission
          ? "Documents received"
          : "Upload credential + ID below";
    const s1: { title: string; detail: string; visual: StepVisual } = {
      title: "Submit application",
      detail: step1Detail,
      visual: isAlreadyVerified || hasSubmission ? "done" : "current",
    };

    let step2Visual: StepVisual = "upcoming";
    if (isAlreadyVerified || wasApproved) step2Visual = "done";
    else if (pendingReview || wasRejected) step2Visual = "current";
    else if (hasSubmission) step2Visual = "current";

    const s2: { title: string; detail: string; visual: StepVisual } = {
      title: wasRejected ? "Admin decision" : "Admin review",
      detail: pendingReview
        ? "We are reviewing your files"
        : wasRejected
          ? "Reviewer requested new or clearer documents"
          : wasApproved && !isAlreadyVerified
            ? "Approved — your account flag updates shortly"
            : isAlreadyVerified
              ? "Request processed"
              : hasSubmission
                ? "Awaiting reviewer"
                : "Waiting for your submission",
      visual: step2Visual,
    };

    let step3Visual: StepVisual = "upcoming";
    if (isAlreadyVerified) step3Visual = "done";
    else if (wasApproved && !isAlreadyVerified) step3Visual = "current";

    const s3: { title: string; detail: string; visual: StepVisual } = {
      title: "Account verified",
      detail: isAlreadyVerified
        ? "You can use bookings and services"
        : wasApproved && !isAlreadyVerified
          ? "Almost there — refresh if this step lingers"
          : "Unlocks after admin approval",
      visual: step3Visual,
    };

    return [s1, s2, s3];
  }, [hasSubmission, pendingReview, wasRejected, wasApproved, isAlreadyVerified]);

  const canEditDocuments = !isAlreadyVerified && !pendingReview && (!hasSubmission || wasRejected);
  const uploadedAgo =
    latestRequest && (latestRequest.credential_url || latestRequest.identity_url)
      ? formatDistanceToNow(parseISO(latestRequest.submitted_at), { addSuffix: true })
      : null;

  const viewDocMutation = useMutation({
    mutationFn: (type: DocSlot) => {
      if (!latestRequest?.id) throw new Error("No saved documents yet.");
      return getVerificationDocumentUrlByType(token, latestRequest.id, type);
    },
    onSuccess: (data) => {
      window.open(data.url, "_blank", "noopener,noreferrer");
    },
    onError: (e) => toast.error((e as Error).message),
  });

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
      setSelectedSlot(null);
      void queryClient.invalidateQueries({ queryKey: ["trainer-verification-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["trainer-me"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!isTrainerRole) {
    return (
      <section className="verify-page">
        <div className="card glass-card verify-restrict">
          <AlertCircle size={48} className="text-warning mb-4" />
          <h2 className="m-0 mb-2">Restricted access</h2>
          <p className="muted m-0">Only trainers and nutritionists can access the verification portal.</p>
        </div>
      </section>
    );
  }

  const submittedLabel = latestRequest
    ? `Last submission ${format(parseISO(latestRequest.submitted_at), "MMM d, yyyy 'at' h:mm a")}`
    : null;

  const fileAccept = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.HEIC";

  function assignFileToSlot(slot: DocSlot, file: File | undefined | null) {
    if (!file) return;
    if (slot === "credential") setCredentialFile(file);
    else setIdentityFile(file);
  }

  function clearLocalSlot(slot: DocSlot) {
    if (slot === "credential") setCredentialFile(null);
    else setIdentityFile(null);
    setSelectedSlot((s) => (s === slot ? null : s));
  }

  function toggleSlot(slot: DocSlot) {
    if (!canEditDocuments) return;
    setSelectedSlot((s) => (s === slot ? null : slot));
  }

  const docRows = useMemo(
    () =>
      [
        { slot: "credential" as const, heading: "Professional credential", serverRef: latestRequest?.credential_url },
        { slot: "identity" as const, heading: "Government ID", serverRef: latestRequest?.identity_url },
      ] as const,
    [latestRequest?.credential_url, latestRequest?.identity_url],
  );

  function getSlotBadge(local: File | null, hasServer: boolean): { label: string; tone: "ok" | "wait" | "bad" | "draft" | "muted" | "ready" } {
    if (isAlreadyVerified) return { label: "Verified", tone: "ok" };
    if (pendingReview) {
      if (hasServer) return { label: "Pending review", tone: "wait" };
      return { label: "Missing", tone: "draft" };
    }
    if (wasRejected) {
      if (local) return { label: "Staged", tone: "ready" };
      if (hasServer) return { label: "Rejected", tone: "bad" };
      return { label: "Required", tone: "draft" };
    }
    if (wasApproved && !isAlreadyVerified) {
      if (hasServer) return { label: "Approved", tone: "ok" };
      return { label: "Required", tone: "draft" };
    }
    if (!hasSubmission) {
      if (local) return { label: "Staged", tone: "ready" };
      return { label: "Required", tone: "draft" };
    }
    if (local) return { label: "Staged", tone: "ready" };
    if (hasServer) return { label: "On file", tone: "muted" };
    return { label: "Required", tone: "draft" };
  }

  const filteredDocRows = useMemo(() => {
    return docRows.filter(({ slot, heading, serverRef }) => {
      const local = slot === "credential" ? credentialFile : identityFile;
      const hasServer = Boolean(serverRef?.trim());
      const storedName = hasServer ? displayNameFromStorageRef(serverRef) : "";
      const primary = local?.name ?? storedName ?? "";
      const q = docSearch.trim().toLowerCase();
      if (q && !heading.toLowerCase().includes(q) && !primary.toLowerCase().includes(q)) return false;
      if (docFilter === "needs") return !local && !hasServer;
      if (docFilter === "staged") return Boolean(local);
      return true;
    });
  }, [docRows, docSearch, docFilter, credentialFile, identityFile]);

  return (
    <section className="verify-page">
      <header className="verify-page-head">
        <div>
          <h1 className="verify-page-title">{user?.role === "nutritionist" ? "Nutritionist verification" : "Trainer verification"}</h1>
          <p className="muted verify-page-lead">Submit credentials and ID so our team can approve your account.</p>
        </div>
        <div className="verify-page-head-right">
          <span className={`verify-status-pill verify-status-pill--${headerStatus.tone}`}>
            <span className="verify-status-dot" aria-hidden />
            {headerStatus.label}
          </span>
          <Link to={ROUTES.trainer.notifications} className="verify-bell" aria-label="Notifications">
            <Bell size={20} />
          </Link>
        </div>
      </header>

      <div className="verify-stepper" role="list" aria-label="Verification progress">
        {steps.map((step, i) => (
          <div key={step.title} className={`verify-step verify-step--${step.visual}`} role="listitem">
            <div className="verify-step-icon" aria-hidden>
              {step.visual === "done" ? (
                <CheckCircle2 size={22} strokeWidth={2.2} />
              ) : step.visual === "current" ? (
                <span className="verify-step-num">{i + 1}</span>
              ) : (
                <Circle size={22} strokeWidth={2} />
              )}
            </div>
            <div className="verify-step-text">
              <p className="verify-step-title">{step.title}</p>
              <p className="verify-step-detail muted">{step.detail}</p>
            </div>
            {i < steps.length - 1 ? <div className="verify-step-connector" aria-hidden /> : null}
          </div>
        ))}
      </div>

      {!trainerProfileCreated && !meQuery.isLoading ? (
        <div className="card glass-card verify-banner verify-banner--warn">
          <h3 className="verify-banner-title">
            <AlertCircle size={20} /> Action required: trainer profile
          </h3>
          <p className="m-0 mb-4">Create your public trainer profile before you can submit verification documents.</p>
          <Link to={ROUTES.trainer.profile} className="primary-btn">
            Go to profile
          </Link>
        </div>
      ) : null}

      {trainerProfileCreated && isAlreadyVerified ? (
        <div className="card glass-card verify-banner verify-banner--ok">
          <h3 className="m-0 mb-2">You are verified</h3>
          <p className="m-0">No further verification steps are required.</p>
        </div>
      ) : null}

      <div className="verify-layout">
        <div className="verify-main">
          <article
            className={`card glass-card verify-credentials ${!trainerProfileCreated || isAlreadyVerified ? "verify-credentials--disabled" : ""}`}
          >
            <div className="verify-credentials-head">
              <div>
                <h2 className="verify-credentials-title">
                  Professional credentials <span className="verify-required-badge">Required</span>
                </h2>
                <p className="muted m-0">Upload clear certification and government ID (PDF, PNG, JPG, HEIC, WebP — max 10MB each).</p>
              </div>
            </div>
            {submittedLabel ? <p className="verify-submitted-hint muted">{submittedLabel}</p> : null}

            <div className="verify-docs-toolbar">
              <div className="verify-docs-search-wrap">
                <Search size={18} className="verify-docs-search-icon" aria-hidden />
                <input
                  type="search"
                  className="verify-docs-search-input"
                  placeholder="Search documents…"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  aria-label="Search documents"
                />
              </div>
              <label className="verify-docs-filter">
                <Filter size={16} className="verify-docs-filter-icon" aria-hidden />
                <span className="verify-docs-filter-text">Filters</span>
                <select
                  className="verify-docs-filter-select"
                  value={docFilter}
                  onChange={(e) => setDocFilter(e.target.value as "all" | "needs" | "staged")}
                  aria-label="Filter documents"
                >
                  <option value="all">All</option>
                  <option value="needs">Missing file</option>
                  <option value="staged">Staged only</option>
                </select>
              </label>
            </div>

            <div
              className={`verify-master-drop ${!canEditDocuments ? "verify-master-drop--locked" : ""}`}
              onDragOver={(e) => {
                if (canEditDocuments) e.preventDefault();
              }}
              onDrop={(e) => {
                if (!canEditDocuments) return;
                e.preventDefault();
                const list = Array.from(e.dataTransfer.files ?? []);
                if (list.length >= 2) {
                  assignFileToSlot("credential", list[0]);
                  assignFileToSlot("identity", list[1]);
                } else if (list.length === 1) {
                  const target = selectedSlot ?? "credential";
                  assignFileToSlot(target, list[0]);
                }
              }}
            >
              <FilePlus size={28} className="muted" aria-hidden />
              <p className="verify-drop-title">Drag and drop files here</p>
              <p className="muted verify-drop-hint m-0">
                Drop two files to fill both slots, or one file for the selected card (defaults to credential).
              </p>
            </div>

            <div className="verify-doc-list">
              {filteredDocRows.length === 0 ? (
                <p className="muted verify-doc-list-empty">No documents match your search or filters.</p>
              ) : (
                filteredDocRows.map(({ slot, heading, serverRef }) => {
                  const local = slot === "credential" ? credentialFile : identityFile;
                  const hasServer = Boolean(serverRef?.trim());
                  const storedDisplay = hasServer ? displayNameFromStorageRef(serverRef) : "";
                  const fileTitle =
                    local?.name ??
                    (hasServer ? storedDisplay : null) ??
                    (canEditDocuments ? "Add a file to continue" : "No document on file");
                  const description = local
                    ? "New file is staged and will upload when you submit the application."
                    : hasServer
                      ? "A copy is saved with your latest verification request. Replace it below if reviewers asked for a clearer file."
                      : canEditDocuments
                        ? "Click this card or use the pencil to choose a PDF or image (max 10MB)."
                        : "This document is locked while your request is under review.";
                  const metaDimmed = pendingReview || (wasApproved && !isAlreadyVerified);
                  const canView = Boolean(latestRequest?.id && hasServer);
                  const rowActive = selectedSlot === slot;
                  const badge = getSlotBadge(local, hasServer);
                  const metaType = local
                    ? `${fileKindFromName(local.name)} · ${(local.size / (1024 * 1024)).toFixed(2)} MB`
                    : hasServer
                      ? `${fileKindFromName(storedDisplay || "file")} · on file`
                      : "—";
                  const metaWhen = local
                    ? "Queued for submit"
                    : hasServer
                      ? uploadedAgo
                        ? `Uploaded ${uploadedAgo}`
                        : "On file"
                      : "Not uploaded";

                  return (
                    <div key={slot} className="verify-doc-card-wrap">
                      <div
                        role={canEditDocuments ? "button" : undefined}
                        tabIndex={canEditDocuments ? 0 : undefined}
                        className={`verify-doc-card ${rowActive ? "verify-doc-card--active" : ""} ${canEditDocuments ? "verify-doc-card--clickable" : ""}`}
                        onClick={() => toggleSlot(slot)}
                        onKeyDown={(e) => {
                          if (!canEditDocuments) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleSlot(slot);
                          }
                        }}
                        onDragOver={(e) => {
                          if (canEditDocuments) e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!canEditDocuments) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const f = e.dataTransfer.files?.[0];
                          assignFileToSlot(slot, f ?? null);
                        }}
                      >
                        <div className="verify-doc-card-thumb" aria-hidden>
                          <div className="verify-doc-card-thumb-inner">
                            <FileText size={32} strokeWidth={1.5} />
                          </div>
                        </div>
                        <div className="verify-doc-card-main">
                          <div className="verify-doc-card-head">
                            <h3 className="verify-doc-card-title">{heading}</h3>
                            <span className={`verify-doc-badge verify-doc-badge--${badge.tone}`}>{badge.label}</span>
                          </div>
                          <p className="verify-doc-card-filename">{fileTitle}</p>
                          <p className="verify-doc-card-desc muted">{description}</p>
                          <div className={`verify-doc-card-meta ${metaDimmed ? "verify-doc-card-meta--dimmed" : ""}`}>
                            <span className="verify-doc-meta-item">
                              <Tag size={16} aria-hidden />
                              {metaType}
                            </span>
                            <span className="verify-doc-meta-item">
                              <Clock size={16} aria-hidden />
                              {metaWhen}
                            </span>
                          </div>
                        </div>
                        <div className="verify-doc-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="verify-icon-btn"
                            title="View saved file"
                            disabled={!canView || viewDocMutation.isPending}
                            onClick={() => viewDocMutation.mutate(slot)}
                            aria-label={`View ${heading}`}
                          >
                            <Eye size={18} />
                          </button>
                          {canEditDocuments ? (
                            <>
                              <button
                                type="button"
                                className="verify-icon-btn"
                                title="Replace file"
                                aria-label={`Edit ${heading}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedSlot !== slot) setSelectedSlot(slot);
                                  const ref = slot === "credential" ? credentialInputRef : identityInputRef;
                                  window.setTimeout(() => ref.current?.click(), 0);
                                }}
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                type="button"
                                className="verify-icon-btn"
                                title="Remove staged file (server copy updates on resubmit)"
                                disabled={!local}
                                aria-label={`Clear staged ${heading}`}
                                onClick={() => clearLocalSlot(slot)}
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {rowActive && canEditDocuments ? (
                        <div className="verify-row-replace">
                          <label className="verify-drop verify-drop--inline">
                            <FilePlus size={22} className="muted" aria-hidden />
                            <span className="verify-drop-title">Choose replacement</span>
                            <span className="muted verify-drop-hint">PDF, PNG, JPG, HEIC, WebP · max 10MB</span>
                            <input
                              ref={slot === "credential" ? credentialInputRef : identityInputRef}
                              type="file"
                              className="verify-file-input"
                              accept={fileAccept}
                              onChange={(e) => {
                                assignFileToSlot(slot, e.target.files?.[0] ?? null);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <label className="verify-upload-label">Notes for reviewers (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="verify-notes"
              placeholder="Name changes, extra context, or credential explanations."
              disabled={!trainerProfileCreated || isAlreadyVerified || pendingReview}
            />

            <div className="verify-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={!credentialFile && !identityFile && !notes && selectedSlot === null}
                onClick={() => {
                  setCredentialFile(null);
                  setIdentityFile(null);
                  setNotes("");
                  setSelectedSlot(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn verify-submit"
                disabled={
                  !trainerProfileCreated ||
                  isAlreadyVerified ||
                  pendingReview ||
                  !credentialFile ||
                  !identityFile ||
                  submitMutation.isPending
                }
                onClick={() => submitMutation.mutate()}
              >
                {submitMutation.isPending ? "Uploading…" : hasSubmission ? "Resubmit application" : "Submit application"}
              </button>
            </div>
          </article>
        </div>

        <aside className="verify-aside">
          <div className="card glass-card verify-help">
            <ShieldCheck size={22} className="verify-help-icon" aria-hidden />
            <h3 className="verify-help-title">Need help?</h3>
            <p className="muted verify-help-text">Questions about documents or status? Open a support thread from your trainer account.</p>
            <Link to={ROUTES.trainer.support} className="secondary-btn verify-help-btn">
              <MessageCircle size={18} aria-hidden />
              Chat with support
            </Link>
          </div>
        </aside>
      </div>

      <style>{`
        .verify-page {
          max-width: 1080px;
          margin: 0 auto;
        }
        .verify-page-head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .verify-page-title {
          margin: 0 0 0.35rem;
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .verify-page-lead {
          margin: 0;
          max-width: 36rem;
        }
        .verify-page-head-right {
          display: flex;
          align-items: center;
          gap: 0.65rem;
        }
        .verify-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.04);
        }
        .verify-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #94a3b8;
        }
        .verify-status-pill--ok .verify-status-dot {
          background: #4ade80;
        }
        .verify-status-pill--ok {
          border-color: rgba(74, 222, 128, 0.4);
          color: #86efac;
        }
        .verify-status-pill--wait .verify-status-dot {
          background: #fbbf24;
        }
        .verify-status-pill--wait {
          border-color: rgba(251, 191, 36, 0.45);
          color: #fcd34d;
        }
        .verify-status-pill--bad .verify-status-dot {
          background: #f87171;
        }
        .verify-status-pill--bad {
          border-color: rgba(248, 113, 113, 0.45);
          color: #fca5a5;
        }
        .verify-status-pill--muted .verify-status-dot {
          background: #64748b;
        }
        .verify-bell {
          display: inline-flex;
          width: 40px;
          height: 40px;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          background: rgba(255, 255, 255, 0.04);
        }
        .verify-bell:hover {
          color: #fff;
          border-color: rgba(129, 140, 248, 0.45);
        }
        .verify-stepper {
          display: flex;
          flex-wrap: wrap;
          align-items: stretch;
          gap: 0.5rem 1.25rem;
          margin-bottom: 1.75rem;
          padding: 1rem 1.15rem;
          border-radius: 14px;
          border: 1px solid var(--border-light);
          background: rgba(255, 255, 255, 0.02);
        }
        .verify-step {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          flex: 1;
          min-width: 160px;
          position: relative;
        }
        .verify-step-icon {
          flex-shrink: 0;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: var(--text-muted);
        }
        .verify-step--done .verify-step-icon {
          color: #4ade80;
        }
        .verify-step--current .verify-step-icon {
          background: rgba(56, 189, 248, 0.18);
          color: #7dd3fc;
          border: 2px solid rgba(56, 189, 248, 0.55);
        }
        .verify-step-num {
          font-weight: 800;
          font-size: 0.95rem;
          line-height: 1;
        }
        .verify-step-text {
          min-width: 0;
        }
        .verify-step-title {
          margin: 0 0 0.2rem;
          font-size: 0.82rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-primary);
        }
        .verify-step-detail {
          margin: 0;
          font-size: 0.78rem;
          line-height: 1.35;
        }
        .verify-step-connector {
          display: none;
        }
        @media (min-width: 720px) {
          .verify-stepper {
            flex-wrap: nowrap;
          }
          .verify-step-connector {
            display: block;
            position: absolute;
            right: -0.65rem;
            top: 50%;
            width: 0.65rem;
            height: 2px;
            background: rgba(148, 163, 184, 0.35);
            transform: translateY(-50%);
          }
          .verify-step:last-child .verify-step-connector {
            display: none;
          }
        }
        .verify-banner {
          padding: 1.15rem 1.25rem;
          border-radius: 14px;
          margin-bottom: 1.25rem;
        }
        .verify-banner--warn {
          border-color: rgba(251, 191, 36, 0.45);
          background: rgba(245, 158, 11, 0.08);
        }
        .verify-banner-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 0.75rem;
          font-size: 1rem;
          color: #fcd34d;
        }
        .verify-banner--ok {
          border-color: rgba(74, 222, 128, 0.4);
          background: rgba(16, 185, 129, 0.1);
        }
        .verify-layout {
          display: grid;
          grid-template-columns: 1fr min(280px, 32%);
          gap: 1.25rem;
          align-items: start;
        }
        @media (max-width: 860px) {
          .verify-layout {
            grid-template-columns: 1fr;
          }
        }
        .verify-credentials {
          padding: 1.35rem 1.4rem;
        }
        .verify-credentials--disabled {
          opacity: 0.55;
          pointer-events: none;
        }
        .verify-credentials-title {
          margin: 0 0 0.35rem;
          font-size: 1.1rem;
          font-weight: 800;
        }
        .verify-required-badge {
          display: inline-block;
          margin-left: 0.35rem;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.2rem 0.45rem;
          border-radius: 6px;
          background: rgba(251, 191, 36, 0.15);
          color: #fcd34d;
          border: 1px solid rgba(251, 191, 36, 0.35);
          vertical-align: middle;
        }
        .verify-submitted-hint {
          margin: 0.75rem 0 0;
          font-size: 0.82rem;
        }
        .verify-docs-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem 1rem;
          margin: 1rem 0 0.85rem;
        }
        .verify-docs-search-wrap {
          flex: 1;
          min-width: 200px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.65rem;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.22);
        }
        .verify-docs-search-icon {
          flex-shrink: 0;
          color: var(--text-muted);
        }
        .verify-docs-search-input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.9rem;
          outline: none;
        }
        .verify-docs-search-input::placeholder {
          color: var(--text-muted);
        }
        .verify-docs-filter {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.6rem;
          border-radius: 10px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
        .verify-docs-filter-icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .verify-docs-filter-text {
          font-size: 0.78rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .verify-docs-filter-select {
          margin-left: 0.15rem;
          border: none;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.25rem 0.4rem;
          border-radius: 6px;
          cursor: pointer;
          max-width: 9rem;
        }
        .verify-master-drop {
          margin: 0 0 1rem;
          position: relative;
          border: 2px dashed rgba(148, 163, 184, 0.45);
          border-radius: 12px;
          padding: 1.5rem 1rem;
          text-align: center;
          background: rgba(0, 0, 0, 0.18);
          transition: border-color 0.2s, background 0.2s;
        }
        .verify-master-drop:not(.verify-master-drop--locked):hover {
          border-color: rgba(56, 189, 248, 0.55);
          background: rgba(56, 189, 248, 0.06);
        }
        .verify-master-drop--locked {
          opacity: 0.5;
          pointer-events: none;
        }
        .verify-doc-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .verify-doc-list-empty {
          margin: 0;
          padding: 1.25rem;
          text-align: center;
          border-radius: 12px;
          border: 1px dashed rgba(148, 163, 184, 0.35);
          background: rgba(0, 0, 0, 0.15);
        }
        .verify-doc-card-wrap {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .verify-doc-card {
          display: flex;
          align-items: stretch;
          gap: 1rem;
          padding: 1rem 1.05rem;
          border-radius: 16px;
          border: 1px solid var(--border-light);
          background: rgba(15, 23, 42, 0.55);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
        }
        .verify-doc-card--clickable {
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .verify-doc-card--clickable:hover {
          border-color: rgba(56, 189, 248, 0.35);
          background: rgba(56, 189, 248, 0.06);
        }
        .verify-doc-card--active {
          border: 2px dashed rgba(56, 189, 248, 0.65);
          background: rgba(56, 189, 248, 0.07);
          box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.15);
        }
        .verify-doc-card--clickable:focus-visible {
          outline: 2px solid rgba(56, 189, 248, 0.7);
          outline-offset: 2px;
        }
        .verify-doc-card-thumb {
          flex-shrink: 0;
          width: 88px;
          min-height: 88px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.25);
          align-self: center;
        }
        .verify-doc-card-thumb-inner {
          width: 100%;
          height: 100%;
          min-height: 88px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(15, 23, 42, 0.95)),
            linear-gradient(225deg, rgba(56, 189, 248, 0.2), transparent);
          color: rgba(255, 255, 255, 0.88);
        }
        .verify-doc-card-main {
          flex: 1;
          min-width: 0;
        }
        .verify-doc-card-head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem 0.75rem;
          margin-bottom: 0.25rem;
        }
        .verify-doc-card-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text-primary);
        }
        .verify-doc-badge {
          flex-shrink: 0;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.28rem 0.55rem;
          border-radius: 999px;
          border: 1px solid var(--border-light);
        }
        .verify-doc-badge--ok {
          color: #86efac;
          border-color: rgba(74, 222, 128, 0.45);
          background: rgba(74, 222, 128, 0.12);
        }
        .verify-doc-badge--wait {
          color: #fcd34d;
          border-color: rgba(251, 191, 36, 0.45);
          background: rgba(251, 191, 36, 0.12);
        }
        .verify-doc-badge--bad {
          color: #fca5a5;
          border-color: rgba(248, 113, 113, 0.45);
          background: rgba(248, 113, 113, 0.12);
        }
        .verify-doc-badge--draft {
          color: #fdba74;
          border-color: rgba(251, 146, 60, 0.45);
          background: rgba(251, 146, 60, 0.12);
        }
        .verify-doc-badge--muted {
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.35);
          background: rgba(148, 163, 184, 0.1);
        }
        .verify-doc-badge--ready {
          color: #7dd3fc;
          border-color: rgba(56, 189, 248, 0.45);
          background: rgba(56, 189, 248, 0.12);
        }
        .verify-doc-card-filename {
          margin: 0 0 0.4rem;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-secondary);
          word-break: break-word;
        }
        .verify-doc-card-desc {
          margin: 0 0 0.65rem;
          font-size: 0.82rem;
          line-height: 1.45;
        }
        .verify-doc-card-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 1.25rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
        }
        .verify-doc-card-meta--dimmed {
          opacity: 0.55;
        }
        .verify-doc-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .verify-doc-meta-item svg {
          flex-shrink: 0;
          opacity: 0.85;
        }
        .verify-doc-card-actions {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          align-items: center;
          justify-content: center;
          gap: 0.15rem;
          padding-left: 0.25rem;
          border-left: 1px solid rgba(148, 163, 184, 0.15);
        }
        @media (max-width: 640px) {
          .verify-doc-card {
            flex-wrap: wrap;
          }
          .verify-doc-card-actions {
            flex-direction: row;
            width: 100%;
            justify-content: flex-end;
            border-left: none;
            border-top: 1px solid rgba(148, 163, 184, 0.15);
            padding: 0.5rem 0 0;
          }
        }
        .verify-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          background: transparent;
          cursor: pointer;
        }
        .verify-icon-btn:hover:not(:disabled) {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
        }
        .verify-icon-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }
        .verify-row-replace {
          padding: 0 0 0.15rem;
        }
        .verify-drop--inline {
          padding: 1rem 0.85rem;
          margin: 0;
        }
        .verify-upload-label {
          display: block;
          font-weight: 700;
          font-size: 0.85rem;
          margin-bottom: 0.4rem;
        }
        .verify-drop {
          position: relative;
          border: 2px dashed rgba(148, 163, 184, 0.45);
          border-radius: 12px;
          padding: 1.75rem 1rem;
          text-align: center;
          background: rgba(0, 0, 0, 0.18);
          transition: border-color 0.2s, background 0.2s;
        }
        .verify-drop:hover {
          border-color: rgba(56, 189, 248, 0.55);
          background: rgba(56, 189, 248, 0.06);
        }
        .verify-drop-title {
          margin: 0.35rem 0 0.15rem;
          font-weight: 700;
          font-size: 0.88rem;
        }
        .verify-drop-hint {
          margin: 0;
          font-size: 0.78rem;
        }
        .verify-file-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }
        .verify-file-name {
          margin: 0.5rem 0 0;
          font-size: 0.82rem;
          color: var(--text-secondary);
        }
        .verify-notes {
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 1rem;
          min-height: 4.5rem;
        }
        .verify-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.65rem;
          margin-top: 0.5rem;
        }
        .verify-submit {
          min-width: 11rem;
        }
        .verify-help {
          padding: 1.15rem 1.2rem;
          text-align: center;
        }
        .verify-help-icon {
          color: #38bdf8;
          margin-bottom: 0.35rem;
        }
        .verify-help-title {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          font-weight: 800;
        }
        .verify-help-text {
          margin: 0 0 1rem;
          font-size: 0.85rem;
          line-height: 1.45;
          text-align: left;
        }
        .verify-help-btn {
          width: 100%;
          justify-content: center;
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          text-decoration: none;
          box-sizing: border-box;
        }
        .verify-restrict {
          padding: 2rem 1.5rem;
          text-align: center;
        }
      `}</style>
    </section>
  );
}
