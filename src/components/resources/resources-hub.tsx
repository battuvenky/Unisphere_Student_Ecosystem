"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Grid2x2,
  List,
  Search,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import { getRealtimeSocket } from "@/lib/realtime-client";

type ResourceType = "pdf" | "doc" | "slide" | "image" | "archive" | "other";

type ResourceItem = {
  id: string;
  title: string;
  description: string;
  subject: string;
  type: ResourceType;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  downloads: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
  };
  downloadUrl: string;
};

type ResourcesResponse = {
  resources: ResourceItem[];
  subjects: string[];
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unitIndex]}`;
}

function toRelativeTime(iso: string) {
  const timestamp = Date.parse(iso);
  const diffMs = Date.now() - timestamp;

  if (diffMs < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }

  return new Date(iso).toLocaleDateString();
}

function typeIcon(type: ResourceType) {
  if (type === "pdf") {
    return <FileText className="h-5 w-5 text-rose-500" />;
  }

  if (type === "doc") {
    return <FileSpreadsheet className="h-5 w-5 text-blue-500" />;
  }

  if (type === "slide") {
    return <FileText className="h-5 w-5 text-amber-500" />;
  }

  if (type === "image") {
    return <FileImage className="h-5 w-5 text-emerald-500" />;
  }

  if (type === "archive") {
    return <FileArchive className="h-5 w-5 text-violet-500" />;
  }

  return <FileText className="h-5 w-5 text-slate-500" />;
}

const typeOptions: Array<{ label: string; value: string }> = [
  { label: "All types", value: "all" },
  { label: "PDF", value: "pdf" },
  { label: "Document", value: "doc" },
  { label: "Slides", value: "slide" },
  { label: "Images", value: "image" },
  { label: "Archives", value: "archive" },
  { label: "Other", value: "other" },
];

function initialsFromName(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "U";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function avatarTone(seed: string) {
  const tones = [
    "bg-sky-500/20 text-sky-700 dark:text-sky-200",
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
    "bg-amber-500/20 text-amber-700 dark:text-amber-200",
    "bg-violet-500/20 text-violet-700 dark:text-violet-200",
    "bg-rose-500/20 text-rose-700 dark:text-rose-200",
  ];

  let hash = 0;
  for (const char of seed) {
    hash += char.charCodeAt(0);
  }

  return tones[Math.abs(hash) % tones.length];
}

export function ResourcesHub() {
  const [resources, setResources] = useState<ResourceItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const fetchResources = async () => {
    setIsLoading(true);
    setError(null);

    const searchParams = new URLSearchParams();
    if (query.trim()) {
      searchParams.set("query", query.trim());
    }
    if (subjectFilter) {
      searchParams.set("subject", subjectFilter);
    }
    if (typeFilter && typeFilter !== "all") {
      searchParams.set("type", typeFilter);
    }

    try {
      const response = await fetch(`/api/resources?${searchParams.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as ResourcesResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load resources");
        setResources([]);
        return;
      }

      const data = payload as ResourcesResponse;
      setResources(data.resources);
      setSubjects(data.subjects);
    } catch {
      setError("Could not connect to resources service");
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchResources();
    }, 180);

    return () => clearTimeout(timer);
  }, [query, subjectFilter, typeFilter]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleResourcesChanged = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void fetchResources();
    };

    socket.on("resources:changed", handleResourcesChanged);
    socket.on("connect", handleResourcesChanged);

    return () => {
      socket.off("resources:changed", handleResourcesChanged);
      socket.off("connect", handleResourcesChanged);
    };
  }, [query, subjectFilter, typeFilter]);

  const metrics = useMemo(() => {
    const totalDownloads = resources.reduce((sum, item) => sum + item.downloads, 0);
    return {
      count: resources.length,
      downloads: totalDownloads,
    };
  }, [resources]);

  const submitUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);

    if (!title.trim() || !description.trim() || !subject.trim()) {
      setUploadError("Please complete title, subject, and description.");
      return;
    }

    if (!file) {
      setUploadError("Choose a file to upload.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.set("title", title.trim());
      formData.set("description", description.trim());
      formData.set("subject", subject.trim());
      formData.set("file", file);

      const response = await fetch("/api/resources", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setUploadError(payload.error ?? "Upload failed");
        return;
      }

      setUploadSuccess("Resource uploaded successfully.");
      setTitle("");
      setDescription("");
      setSubject("");
      setFile(null);
      await fetchResources();
      setTimeout(() => {
        setUploadOpen(false);
        setUploadSuccess(null);
      }, 700);
    } catch {
      setUploadError("Upload failed due to network error.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-6 page-enter">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)]/85 p-5 shadow-sm backdrop-blur md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Academic Hub</p>
            <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Resource Sharing</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Upload notes and material, then discover files with instant search and smart filters.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Upload className="h-4 w-4" />
            Upload Resource
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Visible resources</p>
            <p className="mt-2 text-2xl font-semibold">{metrics.count}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Total downloads</p>
            <p className="mt-2 text-2xl font-semibold">{metrics.downloads}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
            <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Subjects indexed</p>
            <p className="mt-2 text-2xl font-semibold">{subjects.length}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--card)]/80 p-4 shadow-sm backdrop-blur md:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </div>

          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Search</span>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find notes, topics..."
                  className="h-10 w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Subject</span>
              <select
                value={subjectFilter}
                onChange={(event) => setSubjectFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none"
              >
                <option value="">All subjects</option>
                {subjects.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Type</span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none"
              >
                {typeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSubjectFilter("");
                setTypeFilter("all");
              }}
              className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm transition hover:bg-[var(--surface)]"
            >
              Reset filters
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-3 backdrop-blur">
            <p className="text-sm text-[var(--text-secondary)]">{resources.length} results</p>
            <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`rounded-lg px-2 py-1 transition ${
                  viewMode === "grid" ? "bg-[var(--card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
                aria-label="Grid view"
              >
                <Grid2x2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`rounded-lg px-2 py-1 transition ${
                  viewMode === "list" ? "bg-[var(--card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-500">{error}</div>
          ) : null}

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl border border-[var(--border)] bg-[var(--card)]/60" />
              ))}
            </div>
          ) : null}

          {!isLoading && !resources.length ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)]/70 p-10 text-center">
              <p className="text-lg font-medium">No resources found</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Try adjusting filters or upload a new resource.</p>
            </div>
          ) : null}

          {!isLoading ? (
            <div className={viewMode === "grid" ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
              {resources.map((item) => (
                <article
                  key={item.id}
                  className={`group rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                    viewMode === "list" ? "flex items-center gap-4" : ""
                  }`}
                >
                  <div
                    className={`rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3 ${
                      viewMode === "list" ? "shrink-0" : "inline-flex"
                    }`}
                  >
                    {typeIcon(item.type)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold md:text-base">{item.title}</h3>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                        {item.subject}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)] md:text-sm">{item.description}</p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)] md:text-xs">
                      <span>{formatFileSize(item.sizeBytes)}</span>
                      <span>{item.downloads} downloads</span>
                      <span>{toRelativeTime(item.createdAt)}</span>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] text-[10px] font-semibold ${avatarTone(item.uploadedBy.id)}`}>
                        {initialsFromName(item.uploadedBy.name)}
                      </span>
                      <span className="font-medium text-[var(--text-primary)]">{item.uploadedBy.name}</span>
                    </div>
                  </div>

                  <a
                    href={item.downloadUrl}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--card)]"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/20 bg-white/70 p-5 shadow-2xl backdrop-blur-xl dark:bg-slate-900/70">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-secondary)]">Share Resource</p>
                <h2 className="mt-1 text-xl font-semibold">Upload Notes or Files</h2>
              </div>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className="rounded-lg p-1 text-[var(--text-secondary)] transition hover:bg-[var(--surface)]"
                aria-label="Close upload modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitUpload} className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Resource title"
                className="auth-input"
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Subject (e.g. Operating Systems)"
                  className="auth-input"
                  required
                />
                <input
                  type="file"
                  className="auth-input file:mr-2 file:rounded-md file:border-0 file:bg-[var(--surface)] file:px-2 file:py-1 file:text-xs"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  required
                />
              </div>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe what this file contains"
                className="auth-input min-h-24"
                required
              />

              {uploadError ? <p className="text-sm text-rose-500">{uploadError}</p> : null}
              {uploadSuccess ? <p className="text-sm text-emerald-500">{uploadSuccess}</p> : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm transition hover:bg-[var(--surface)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
