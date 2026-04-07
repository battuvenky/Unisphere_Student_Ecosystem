"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Tag, Pin, Trash2, Save, FolderTree, NotebookPen, FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type NoteCategory = "general" | "class" | "project" | "placement" | "personal";

type NoteItem = {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

type NotesResponse = {
  notes: NoteItem[];
  summary: {
    total: number;
    pinned: number;
    categoryCounts: Array<{ category: NoteCategory; count: number }>;
    tags: Array<{ name: string; count: number }>;
  };
  filterOptions: {
    categories: NoteCategory[];
  };
};

const categoryLabel: Record<NoteCategory, string> = {
  general: "General",
  class: "Class",
  project: "Project",
  placement: "Placement",
  personal: "Personal",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewText(content: string) {
  return content.replace(/\n+/g, " ").slice(0, 110) || "Empty note";
}

export function NotesHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [summary, setSummary] = useState<NotesResponse["summary"] | null>(null);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | NoteCategory>("all");
  const [activeTag, setActiveTag] = useState("");

  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<NoteCategory>("general");
  const [tagsInput, setTagsInput] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((item) => item.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const hydrateEditorFromNote = (note: NoteItem | null) => {
    if (!note) {
      setTitle("");
      setContent("");
      setCategory("general");
      setTagsInput("");
      setIsPinned(false);
      return;
    }

    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTagsInput(note.tags.join(", "));
    setIsPinned(note.isPinned);
  };

  const fetchNotes = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (activeCategory !== "all") {
        params.set("category", activeCategory);
      }
      if (activeTag) {
        params.set("tag", activeTag);
      }

      const response = await fetch(`/api/notes?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as NotesResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load notes");
        setNotes([]);
        setSummary(null);
        return;
      }

      const data = payload as NotesResponse;
      setNotes(data.notes);
      setSummary(data.summary);

      const activeExists = data.notes.some((note) => note.id === selectedNoteId);
      if (!activeExists) {
        const first = data.notes[0] ?? null;
        setSelectedNoteId(first?.id ?? "");
        hydrateEditorFromNote(first);
      }
    } catch {
      setError("Could not connect to notes service");
      setNotes([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchNotes();
    }, 140);

    return () => clearTimeout(timer);
  }, [query, activeCategory, activeTag]);

  const selectNote = (note: NoteItem) => {
    setSelectedNoteId(note.id);
    hydrateEditorFromNote(note);
    setSuccess(null);
  };

  const createNewNote = async () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Untitled note",
          content: "",
          category: "general",
          tags: [],
        }),
      });

      const payload = (await response.json()) as { note?: NoteItem; error?: string };

      if (!response.ok || !payload.note) {
        setError(payload.error ?? "Could not create note");
        return;
      }

      await fetchNotes();
      setSelectedNoteId(payload.note.id);
      hydrateEditorFromNote(payload.note);
      setSuccess("New note created");
    } catch {
      setError("Could not create note");
    } finally {
      setSaving(false);
    }
  };

  const saveSelectedNote = async () => {
    if (!selectedNoteId || saving) {
      return;
    }

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const tags = tagsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch(`/api/notes/${selectedNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          category,
          tags,
          isPinned,
        }),
      });

      const payload = (await response.json()) as { note?: NoteItem; error?: string };

      if (!response.ok || !payload.note) {
        setError(payload.error ?? "Could not save note");
        return;
      }

      await fetchNotes();
      setSelectedNoteId(payload.note.id);
      hydrateEditorFromNote(payload.note);
      setSuccess("Saved");
    } catch {
      setError("Could not save note");
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedNote = async () => {
    if (!selectedNoteId || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/notes/${selectedNoteId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not delete note");
        return;
      }

      setSelectedNoteId("");
      await fetchNotes();
      setSuccess("Note deleted");
    } catch {
      setError("Could not delete note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">Personal Notes</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Capture ideas, organize by category, and keep everything searchable.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{success}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_340px_1fr]">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-sm backdrop-blur-lg transition-all duration-300 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Categories</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Knowledge Base</p>
            </div>
            <button
              type="button"
              onClick={() => void createNewNote()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] transition-all duration-200 hover:scale-[1.03] hover:shadow"
              aria-label="Create note"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                activeCategory === "all"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="inline-flex items-center gap-2"><FolderTree size={14} /> All</span>
              <span className="text-xs">{summary?.total ?? 0}</span>
            </button>

            {(summary?.categoryCounts ?? []).map((item) => (
              <button
                key={item.category}
                type="button"
                onClick={() => setActiveCategory(item.category)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                  activeCategory === item.category
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{categoryLabel[item.category]}</span>
                <span className="text-xs">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <p className="mb-2 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Popular tags</p>
            <div className="flex flex-wrap gap-2">
              {(summary?.tags ?? []).length === 0 ? (
                <p className="text-xs text-[var(--text-secondary)]">No tags yet</p>
              ) : (
                (summary?.tags ?? []).slice(0, 12).map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => setActiveTag((prev) => (prev === tag.name ? "" : tag.name))}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
                      activeTag === tag.name
                        ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    #{tag.name} ({tag.count})
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-sm backdrop-blur-lg transition-all duration-300 hover:shadow-md">
          <div className="relative mb-3">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Search title, content, tags"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm outline-none transition-all duration-200 placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
            />
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-secondary)]">Loading notes...</p>
            ) : notes.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No notes yet 📝"
                message="Start creating notes to organize your thoughts, ideas, and learnings."
                actionLabel="Create Note"
                onAction={() => {
                setSelectedNoteId("");
                setTitle("");
                setContent("");
                setCategory("general");
                setTagsInput("");
                setIsPinned(false);
              }}
              />
            ) : (
              notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note)}
                  className={`w-full rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    selectedNoteId === note.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)] bg-[var(--card)]"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-semibold text-[var(--text-primary)]">{note.title}</p>
                    {note.isPinned ? <Pin size={13} className="text-[var(--accent)]" /> : null}
                  </div>
                  <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{previewText(note.content)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                      {categoryLabel[note.category]}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{formatTime(note.updatedAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-sm backdrop-blur-lg transition-all duration-300 hover:shadow-md">
          {!selectedNote ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 text-center">
              <NotebookPen size={28} className="mb-3 text-[var(--text-secondary)]" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Select a note</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Choose a note from the list or create a new one.</p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Editor</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={saveSelectedNote}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-65"
                  >
                    <Save size={13} /> {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedNote}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/20 disabled:opacity-65"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Note title"
                className="mb-3 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold outline-none transition-colors focus:border-[var(--accent)]"
              />

              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as NoteCategory)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
                  >
                    {(summary?.categoryCounts ?? []).map((item) => (
                      <option key={item.category} value={item.category}>
                        {categoryLabel[item.category]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Tags (comma separated)</span>
                  <div className="relative">
                    <Tag size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                    <input
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="exam, revision, dsa"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 pl-8 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                    />
                  </div>
                </label>
              </div>

              <label className="mb-3 inline-flex cursor-pointer items-center gap-2 text-xs text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(event) => setIsPinned(event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] bg-[var(--card)] accent-[var(--accent)]"
                />
                Pin this note
              </label>

              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write your note here..."
                className="min-h-[360px] w-full rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-sm leading-6 text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent)]"
              />

              <div className="mt-2 text-[11px] text-[var(--text-secondary)]">Last updated {formatTime(selectedNote.updatedAt)}</div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
