import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, ExternalLink, Filter, Search, Tag, X } from "lucide-react";
import { ROUTES } from "../lib/navigation";
import { getTrainers } from "../services/trainers";
import type { Trainer } from "../types/api";

export type ClientBrowseVariant = "trainer" | "nutritionist";

function isNutritionSpecialty(value: string | null | undefined): boolean {
  const text = (value ?? "").toLowerCase();
  return text.includes("nutri") || text.includes("diet") || text.includes("meal");
}

function filterPool(trainers: Trainer[], variant: ClientBrowseVariant): Trainer[] {
  if (variant === "nutritionist") {
    return trainers.filter(
      (t) => t.profiles?.role === "nutritionist" || isNutritionSpecialty(t.specialty),
    );
  }
  return trainers.filter((t) => t.profiles?.role !== "nutritionist" && !isNutritionSpecialty(t.specialty));
}

function avatarUrlFor(trainer: Trainer): string | null {
  const raw = trainer.profiles?.avatar_url?.trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return null;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

type VerificationFilter = "all" | "verified" | "unverified";

export function ClientProfessionalBrowse({ variant }: { variant: ClientBrowseVariant }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VerificationFilter>("all");
  const [previewTrainer, setPreviewTrainer] = useState<Trainer | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["trainers"],
    queryFn: getTrainers,
  });

  const pool = useMemo(() => filterPool(data ?? [], variant), [data, variant]);

  const copy = useMemo(() => {
    if (variant === "nutritionist") {
      return {
        entityPlural: "nutritionists",
        defaultName: "Nutritionist",
        defaultBio: "Personalized nutrition coaching and meal guidance.",
        defaultSpecialty: "Nutrition",
        bookHref: `${ROUTES.client.book}?with=nutritionist`,
        bookLabel: "Book with a nutritionist",
        searchAria: "Search nutritionists",
      };
    }
    return {
      entityPlural: "trainers",
      defaultName: "Trainer",
      defaultBio: "Strength, conditioning, and coaching tailored to your goals.",
      defaultSpecialty: "Training",
      bookHref: `${ROUTES.client.book}?with=trainer`,
      bookLabel: "Book with a trainer",
      searchAria: "Search trainers",
    };
  }, [variant]);

  useEffect(() => {
    if (!previewTrainer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewTrainer(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [previewTrainer]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = pool;
    if (query) {
      list = list.filter((trainer) => {
        const name = trainer.profiles?.full_name ?? "";
        const specialty = trainer.specialty ?? "";
        const bio = trainer.bio ?? "";
        return [name, specialty, bio].some((field) => field.toLowerCase().includes(query));
      });
    }
    if (filter === "verified") list = list.filter((t) => t.verified);
    if (filter === "unverified") list = list.filter((t) => !t.verified);
    return [...list].sort((a, b) => {
      const na = (a.profiles?.full_name ?? "").toLowerCase();
      const nb = (b.profiles?.full_name ?? "").toLowerCase();
      return na.localeCompare(nb);
    });
  }, [pool, search, filter]);

  if (isLoading) {
    return (
      <section className="nf-browse">
        <p className="muted">Loading {copy.entityPlural}…</p>
        <ClientProfessionalBrowseStyles />
      </section>
    );
  }
  if (isError) {
    return (
      <section className="nf-browse">
        <p className="error">{(error as Error).message}</p>
        <ClientProfessionalBrowseStyles />
      </section>
    );
  }

  return (
    <section className="nf-browse">
      <div className="nf-toolbar">
        <div className="nf-search-wrap">
          <Search size={18} className="nf-search-icon" aria-hidden />
          <input
            type="search"
            className="nf-search-input"
            placeholder="Search services…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={copy.searchAria}
          />
        </div>
        <label className="nf-filter">
          <Filter size={16} className="nf-filter-icon" aria-hidden />
          <span className="nf-filter-text">Filters</span>
          <select
            className="nf-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as VerificationFilter)}
            aria-label="Filter by verification"
          >
            <option value="all">All</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
          </select>
        </label>
      </div>

      <div className="nf-quick-link">
        <Link className="secondary-link" to={copy.bookHref}>
          {copy.bookLabel}
        </Link>
      </div>

      <p className="nf-count muted">
        Showing {filtered.length} of {pool.length} {copy.entityPlural}
      </p>

      <div className="nf-list">
        {filtered.map((trainer) => (
          <ClientProfessionalCard
            key={trainer.id}
            trainer={trainer}
            defaultName={copy.defaultName}
            defaultBio={copy.defaultBio}
            defaultSpecialty={copy.defaultSpecialty}
            onOpenPreview={() => setPreviewTrainer(trainer)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="nf-empty muted">No {copy.entityPlural} match your search or filters.</p>
      ) : null}

      {previewTrainer ? (
        <ProfessionalPreviewModal
          trainer={previewTrainer}
          variant={variant}
          defaultName={copy.defaultName}
          defaultBio={copy.defaultBio}
          defaultSpecialty={copy.defaultSpecialty}
          onClose={() => setPreviewTrainer(null)}
        />
      ) : null}

      <ClientProfessionalBrowseStyles />
    </section>
  );
}

function ProfessionalPreviewModal({
  trainer,
  variant,
  defaultName,
  defaultBio,
  defaultSpecialty,
  onClose,
}: {
  trainer: Trainer;
  variant: ClientBrowseVariant;
  defaultName: string;
  defaultBio: string;
  defaultSpecialty: string;
  onClose: () => void;
}) {
  const name = trainer.profiles?.full_name?.trim() || defaultName;
  const bio = trainer.bio?.trim() || defaultBio;
  const specialty = trainer.specialty?.trim() || defaultSpecialty;
  const img = avatarUrlFor(trainer);
  const verified = trainer.verified;
  const withParam = variant === "nutritionist" ? "nutritionist" : "trainer";
  const profilePath = `${ROUTES.client.trainers}/${trainer.id}`;
  const bookPath = `${ROUTES.client.book}?trainerId=${encodeURIComponent(trainer.id)}&with=${withParam}`;

  return (
    <div className="nf-modal-root" role="dialog" aria-modal="true" aria-labelledby="nf-preview-title">
      <button type="button" className="nf-modal-backdrop" aria-label="Close preview" onClick={onClose} />
      <div className="nf-modal-panel">
        <button type="button" className="nf-modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="nf-modal-top">
          <div className="nf-modal-thumb" aria-hidden>
            {img ? (
              <img src={img} alt="" loading="lazy" />
            ) : (
              <div className="nf-thumb-placeholder">{initials(name)}</div>
            )}
          </div>
          <div className="nf-modal-head">
            <h2 id="nf-preview-title" className="nf-modal-title">
              {name}
            </h2>
            <span className={`nf-badge ${verified ? "nf-badge--active" : "nf-badge--paused"}`}>
              {verified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>
        <p className="nf-modal-meta muted">
          <span className="nf-modal-meta-item">
            <Clock size={16} aria-hidden />
            {specialty}
          </span>
          <span className="nf-modal-meta-item">
            <Tag size={16} aria-hidden />
            <strong className="nf-price-strong">${Number(trainer.hourly_rate).toFixed(2)}</strong> / hour
          </span>
        </p>
        <p className="nf-modal-bio">{bio}</p>
        <div className="nf-modal-actions">
          <Link to={profilePath} className="secondary-btn nf-modal-btn" onClick={onClose}>
            <ExternalLink size={18} aria-hidden />
            View full profile
          </Link>
          {verified ? (
            <Link to={bookPath} className="primary-btn nf-modal-btn" onClick={onClose}>
              <Calendar size={18} aria-hidden />
              Book a session
            </Link>
          ) : (
            <button type="button" className="primary-btn nf-modal-btn" disabled title="This professional is not verified yet">
              <Calendar size={18} aria-hidden />
              Book a session
            </button>
          )}
        </div>
        {!verified ? (
          <p className="nf-modal-hint muted">Booking is available once this professional completes verification.</p>
        ) : null}
      </div>
    </div>
  );
}

function ClientProfessionalCard({
  trainer,
  defaultName,
  defaultBio,
  defaultSpecialty,
  onOpenPreview,
}: {
  trainer: Trainer;
  defaultName: string;
  defaultBio: string;
  defaultSpecialty: string;
  onOpenPreview: () => void;
}) {
  const name = trainer.profiles?.full_name?.trim() || defaultName;
  const bio = trainer.bio?.trim() || defaultBio;
  const specialty = trainer.specialty?.trim() || defaultSpecialty;
  const img = avatarUrlFor(trainer);
  const verified = trainer.verified;

  return (
    <button
      type="button"
      className={`nf-card nf-card--tile ${verified ? "" : "nf-card--muted"}`}
      onClick={onOpenPreview}
      aria-haspopup="dialog"
    >
      <div className="nf-thumb" aria-hidden>
        {img ? (
          <img src={img} alt="" loading="lazy" />
        ) : (
          <div className="nf-thumb-placeholder">{initials(name)}</div>
        )}
      </div>
      <div className="nf-main">
        <div className="nf-head">
          <h3 className="nf-title">{name}</h3>
          <span className={`nf-badge ${verified ? "nf-badge--active" : "nf-badge--paused"}`}>
            {verified ? "Verified" : "Unverified"}
          </span>
        </div>
        <p className="nf-desc">{bio}</p>
        <div className="nf-meta">
          <span className="nf-meta-item">
            <Clock size={16} aria-hidden />
            {specialty}
          </span>
          <span className="nf-meta-item">
            <Tag size={16} aria-hidden />
            <span className="nf-price-strong">${Number(trainer.hourly_rate).toFixed(2)}</span>
            <span>/ hour</span>
          </span>
        </div>
      </div>
    </button>
  );
}

function ClientProfessionalBrowseStyles() {
  return (
    <style>{`
        .nf-browse {
          max-width: 880px;
          margin: 0 auto;
        }
        .nf-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.65rem 1rem;
          margin-bottom: 0.65rem;
        }
        .nf-quick-link {
          margin-bottom: 0.85rem;
        }
        .nf-search-wrap {
          flex: 1;
          min-width: 220px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.22);
        }
        .nf-search-icon {
          flex-shrink: 0;
          color: var(--text-muted);
        }
        .nf-search-input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          color: var(--text-primary);
          font-size: 0.92rem;
          outline: none;
        }
        .nf-search-input::placeholder {
          color: var(--text-muted);
        }
        .nf-filter {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.65rem;
          border-radius: 12px;
          border: 1px solid var(--border-light);
          background: rgba(0, 0, 0, 0.22);
          cursor: pointer;
        }
        .nf-filter-icon {
          color: var(--text-muted);
        }
        .nf-filter-text {
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-secondary);
        }
        .nf-filter-select {
          margin-left: 0.15rem;
          border: none;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-primary);
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.28rem 0.45rem;
          border-radius: 8px;
          cursor: pointer;
          max-width: 11rem;
        }
        .nf-count {
          margin: 0 0 1rem;
          font-size: 0.82rem;
        }
        .nf-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .nf-empty {
          margin: 1rem 0 0;
          text-align: center;
          padding: 1.5rem;
          border-radius: 14px;
          border: 1px dashed rgba(148, 163, 184, 0.35);
        }
        .nf-card {
          display: flex;
          align-items: stretch;
          gap: 1rem;
          padding: 1rem 1.1rem;
          border-radius: 16px;
          border: 1px solid var(--border-light);
          background: rgba(21, 26, 33, 0.92);
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
          text-decoration: none;
          color: inherit;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
        }
        .nf-card:hover {
          border-color: rgba(56, 189, 248, 0.4);
          background: rgba(21, 26, 33, 1);
        }
        .nf-card:focus-visible {
          outline: 2px solid rgba(56, 189, 248, 0.65);
          outline-offset: 2px;
        }
        .nf-card--tile {
          appearance: none;
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--border-light);
          text-align: left;
          font: inherit;
          color: inherit;
          cursor: pointer;
        }
        .nf-card--muted {
          opacity: 0.72;
        }
        .nf-card--muted:hover {
          opacity: 0.88;
        }
        .nf-thumb {
          flex-shrink: 0;
          width: 88px;
          height: 88px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.25);
          align-self: center;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.35), rgba(15, 23, 42, 0.95));
        }
        .nf-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .nf-thumb-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          font-weight: 800;
          color: rgba(255, 255, 255, 0.92);
          letter-spacing: 0.02em;
        }
        .nf-main {
          flex: 1;
          min-width: 0;
        }
        .nf-head {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem 0.75rem;
          margin-bottom: 0.35rem;
        }
        .nf-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1.25;
        }
        .nf-badge {
          flex-shrink: 0;
          font-size: 0.62rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          padding: 0.3rem 0.55rem;
          border-radius: 999px;
          border: 1px solid transparent;
        }
        .nf-badge--active {
          color: #86efac;
          border-color: rgba(74, 222, 128, 0.45);
          background: rgba(74, 222, 128, 0.14);
        }
        .nf-badge--paused {
          color: #94a3b8;
          border-color: rgba(148, 163, 184, 0.35);
          background: rgba(148, 163, 184, 0.12);
        }
        .nf-desc {
          margin: 0 0 0.65rem;
          font-size: 0.84rem;
          line-height: 1.45;
          color: #9ca3af;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .nf-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem 1.35rem;
          font-size: 0.8rem;
          font-weight: 600;
          color: #e5e7eb;
        }
        .nf-card--muted .nf-meta {
          color: #9ca3af;
        }
        .nf-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .nf-meta-item svg {
          flex-shrink: 0;
          opacity: 0.85;
        }
        .nf-price-strong {
          font-weight: 800;
          color: #fff;
        }
        .nf-card--muted .nf-price-strong {
          color: #9ca3af;
        }
        @media (max-width: 540px) {
          .nf-card {
            flex-wrap: wrap;
          }
          .nf-thumb {
            width: 72px;
            height: 72px;
          }
        }
        .nf-modal-root {
          position: fixed;
          inset: 0;
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          box-sizing: border-box;
        }
        .nf-modal-backdrop {
          position: absolute;
          inset: 0;
          border: none;
          padding: 0;
          margin: 0;
          cursor: pointer;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(6px);
        }
        .nf-modal-panel {
          position: relative;
          z-index: 1;
          width: min(440px, 100%);
          max-height: min(90vh, 640px);
          overflow-y: auto;
          border-radius: 18px;
          border: 1px solid var(--border-light);
          background: rgba(17, 21, 28, 0.98);
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
          padding: 1.35rem 1.4rem 1.25rem;
        }
        .nf-modal-close {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          width: 40px;
          height: 40px;
          border: none;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text-secondary);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .nf-modal-close:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.12);
        }
        .nf-modal-top {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 0.65rem;
          padding-right: 2.5rem;
        }
        .nf-modal-thumb {
          flex-shrink: 0;
          width: 96px;
          height: 96px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.25);
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.35), rgba(15, 23, 42, 0.95));
        }
        .nf-modal-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .nf-modal-head {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .nf-modal-title {
          margin: 0;
          font-size: 1.2rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #fff;
          line-height: 1.25;
        }
        .nf-modal-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
          margin: 0 0 0.85rem;
          font-size: 0.84rem;
          font-weight: 600;
        }
        .nf-modal-meta-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .nf-modal-bio {
          margin: 0 0 1.15rem;
          font-size: 0.9rem;
          line-height: 1.55;
          color: #cbd5e1;
        }
        .nf-modal-actions {
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .nf-modal-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          width: 100%;
          box-sizing: border-box;
          text-decoration: none;
        }
        .nf-modal-btn.primary-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
        .nf-modal-hint {
          margin: 0.75rem 0 0;
          font-size: 0.8rem;
          text-align: center;
        }
      `}</style>
  );
}
