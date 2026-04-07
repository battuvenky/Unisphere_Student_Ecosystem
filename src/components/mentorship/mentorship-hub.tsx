"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Handshake, MessageSquare, Search, Sparkles, UserRound, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type MentorCard = {
  id: string;
  fullName: string;
  department: string;
  year: string;
  headline: string;
  skills: string[];
  achievements: string[];
  matchScore: number;
};

type RequestStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

type RequestItem = {
  id: string;
  topic: string;
  message: string;
  preferredDate: string;
  durationMinutes: number;
  status: RequestStatus;
  createdAt: string;
  role: "incoming" | "outgoing";
  partner: {
    id: string;
    fullName: string;
    department: string;
    year: string;
  };
};

type MentorshipResponse = {
  mentors: MentorCard[];
  requests: RequestItem[];
};

const statusClass: Record<RequestStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/35",
  accepted: "bg-sky-500/15 text-sky-300 border-sky-500/35",
  declined: "bg-rose-500/15 text-rose-300 border-rose-500/35",
  completed: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
  cancelled: "bg-slate-500/15 text-slate-300 border-slate-500/35",
};

function toTitleCase(input: string) {
  return input
    .split("_")
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function MentorshipHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mentors, setMentors] = useState<MentorCard[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [query, setQuery] = useState("");

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<MentorCard | null>(null);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/mentorship", { cache: "no-store" });
      const payload = (await response.json()) as MentorshipResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load mentorship data");
        setMentors([]);
        setRequests([]);
        return;
      }

      const typed = payload as MentorshipResponse;
      setMentors(typed.mentors);
      setRequests(typed.requests);
    } catch {
      setError("Could not connect to mentorship service");
      setMentors([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredMentors = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) {
      return mentors;
    }

    return mentors.filter(
      (mentor) =>
        mentor.fullName.toLowerCase().includes(normalized) ||
        mentor.department.toLowerCase().includes(normalized) ||
        mentor.headline.toLowerCase().includes(normalized) ||
        mentor.skills.some((skill) => skill.toLowerCase().includes(normalized))
    );
  }, [mentors, query]);

  const incomingCount = requests.filter((request) => request.role === "incoming" && request.status === "pending").length;
  const activeCount = requests.filter((request) => ["pending", "accepted"].includes(request.status)).length;

  const openRequestModal = (mentor: MentorCard) => {
    setSelectedMentor(mentor);
    setTopic("");
    setMessage("");
    setPreferredDate("");
    setDurationMinutes(60);
    setShowRequestModal(true);
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedMentor || !topic.trim() || !message.trim() || !preferredDate) {
      setError("Please fill all request details.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/mentorship", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          mentorId: selectedMentor.id,
          topic: topic.trim(),
          message: message.trim(),
          preferredDate,
          durationMinutes,
        }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Could not send mentorship request");
        return;
      }

      setShowRequestModal(false);
      setSelectedMentor(null);
      await fetchData();
    } catch {
      setError("Could not send mentorship request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRequestStatus = async (requestId: string, status: "accepted" | "declined" | "completed" | "cancelled") => {
    setError(null);

    const response = await fetch("/api/mentorship", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-status",
        requestId,
        status,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(payload.error ?? "Could not update request status");
      return;
    }

    await fetchData();
  };

  return (
    <section className="space-y-6">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Mentorship</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-primary)] md:text-3xl">Peer Mentorship Network</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Connect juniors with seniors, discover best-fit mentors, and request focused guidance sessions.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Active requests</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{activeCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Incoming</p>
              <p className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{incomingCount}</p>
            </div>
          </div>
        </div>

        <div className="relative mt-5 max-w-xl">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search mentors by name, department, or skill"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-3 text-sm outline-none transition-all duration-200 placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)]"
          />
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <section className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/75 p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Mentor matches</h2>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading mentor suggestions...</p>
          ) : filteredMentors.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No mentors matching filters 🔍"
              message="Try adjusting your search criteria or ask classmates to update their profiles."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredMentors.map((mentor) => (
                <article
                  key={mentor.id}
                  className="group rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{mentor.fullName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{mentor.department} • {mentor.year}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      {mentor.matchScore}% match
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-[var(--text-secondary)]">{mentor.headline || "Available for guidance sessions."}</p>

                  {mentor.skills.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mentor.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-medium text-sky-200"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {mentor.achievements.length ? (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-2.5 text-xs text-[var(--text-secondary)]">
                      <p className="mb-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        <Sparkles size={12} /> Achievements
                      </p>
                      <p>{mentor.achievements.join(" • ")}</p>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => openRequestModal(mentor)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    <Handshake size={16} /> Request mentorship
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/75 p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-[var(--accent)]" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Session requests</h2>
          </div>

          {loading ? (
            <p className="text-sm text-[var(--text-secondary)]">Loading requests...</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="No requests yet 🤝"
              message="Request mentorship from the mentors above to get started."
            />
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <article key={request.id} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{request.topic}</p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {request.role === "incoming" ? "From" : "To"} {request.partner.fullName} • {request.partner.year}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass[request.status]}`}>
                      {toTitleCase(request.status)}
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{request.message}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      <CalendarClock size={12} /> {formatDate(request.preferredDate)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1">
                      <UserRound size={12} /> {request.durationMinutes} mins
                    </span>
                  </div>

                  {request.status === "pending" && request.role === "incoming" ? (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => void updateRequestStatus(request.id, "accepted")}
                        className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateRequestStatus(request.id, "declined")}
                        className="rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200"
                      >
                        Decline
                      </button>
                    </div>
                  ) : null}

                  {request.status === "accepted" && request.role === "incoming" ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => void updateRequestStatus(request.id, "completed")}
                        className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-200"
                      >
                        Mark completed
                      </button>
                    </div>
                  ) : null}

                  {request.status === "pending" && request.role === "outgoing" ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => void updateRequestStatus(request.id, "cancelled")}
                        className="rounded-lg border border-slate-500/35 bg-slate-500/10 px-3 py-1.5 text-xs font-semibold text-slate-200"
                      >
                        Cancel request
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {showRequestModal && selectedMentor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Request session with {selectedMentor.fullName}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Share what support you need, then send your mentorship request.</p>

            <form onSubmit={submitRequest} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Topic</label>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Dynamic programming roadmap"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Message</label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  placeholder="I need help building a 6-week DSA prep plan and interview practice routine."
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[var(--accent)]"
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Preferred date</label>
                  <input
                    type="date"
                    value={preferredDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setPreferredDate(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[var(--accent)]"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Duration</label>
                  <select
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all duration-200 focus:border-[var(--accent)]"
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>120 minutes</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-md transition-transform duration-200 hover:scale-[1.02] disabled:opacity-70"
                >
                  {isSubmitting ? "Sending..." : "Send request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}