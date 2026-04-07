"use client";

import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { Award, BriefcaseBusiness, LoaderCircle, PencilLine, Plus, Save, Trash2, UserRound } from "lucide-react";
import type { SessionUser, UserAchievement, UserSkill } from "@/lib/auth/types";
import type { ProfileActivityItem } from "@/lib/profile-activity";

type ProfilePortfolioProps = {
  user: SessionUser;
  activities: ProfileActivityItem[];
};

type PortfolioTab = "about" | "activity" | "skills";

const tabOptions: Array<{ id: PortfolioTab; label: string }> = [
  { id: "about", label: "About" },
  { id: "activity", label: "Activity" },
  { id: "skills", label: "Skills" },
];

function timeAgo(value: string): string {
  const diff = Date.now() - Date.parse(value);
  const minutes = Math.max(1, Math.floor(diff / 60_000));

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function localId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ProfilePortfolio({ user, activities }: ProfilePortfolioProps) {
  const [tab, setTab] = useState<PortfolioTab>("about");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [fullName, setFullName] = useState(user.profile.fullName);
  const [profileImageUrl, setProfileImageUrl] = useState(user.profile.profileImageUrl ?? "");
  const [department, setDepartment] = useState(user.profile.department);
  const [year, setYear] = useState(user.profile.year);
  const [experience, setExperience] = useState(user.profile.experience ?? "");
  const [specialization, setSpecialization] = useState(user.profile.specialization ?? "");
  const [headline, setHeadline] = useState(user.profile.headline ?? "");
  const [bio, setBio] = useState(user.profile.bio ?? "");

  const [skills, setSkills] = useState<UserSkill[]>(user.profile.skills ?? []);
  const [achievements, setAchievements] = useState<UserAchievement[]>(user.profile.achievements ?? []);

  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("Technical");
  const [newSkillLevel, setNewSkillLevel] = useState(70);

  const [newAchievementTitle, setNewAchievementTitle] = useState("");
  const [newAchievementIssuer, setNewAchievementIssuer] = useState("");
  const [newAchievementDate, setNewAchievementDate] = useState("");
  const [newAchievementDescription, setNewAchievementDescription] = useState("");

  const metrics = useMemo(() => {
    const technicalSkillCount = skills.filter((skill) => skill.category.toLowerCase().includes("tech")).length;

    return {
      skills: skills.length,
      technicalSkillCount,
      achievements: achievements.length,
      contributions: activities.length,
    };
  }, [activities.length, achievements.length, skills]);

  const savePatch = async (patch: Record<string, unknown>) => {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update profile");
      }

      setSuccess(data.message ?? "Profile updated");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const onSaveIdentity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await savePatch({
      fullName,
      profileImageUrl,
      department,
      year,
      experience,
      specialization,
      headline,
      bio,
    });
  };

  const addSkill = () => {
    if (!newSkillName.trim()) {
      return;
    }

    setSkills((prev) => [
      {
        id: localId(),
        name: newSkillName.trim(),
        category: newSkillCategory.trim() || "Technical",
        level: Math.min(100, Math.max(1, Math.round(newSkillLevel))),
      },
      ...prev,
    ]);

    setNewSkillName("");
    setNewSkillCategory("Technical");
    setNewSkillLevel(70);
  };

  const removeSkill = (id: string) => {
    setSkills((prev) => prev.filter((item) => item.id !== id));
  };

  const addAchievement = () => {
    if (!newAchievementTitle.trim() || !newAchievementIssuer.trim()) {
      return;
    }

    setAchievements((prev) => [
      {
        id: localId(),
        title: newAchievementTitle.trim(),
        issuer: newAchievementIssuer.trim(),
        date: newAchievementDate.trim() || new Date().toISOString().slice(0, 10),
        description: newAchievementDescription.trim(),
      },
      ...prev,
    ]);

    setNewAchievementTitle("");
    setNewAchievementIssuer("");
    setNewAchievementDate("");
    setNewAchievementDescription("");
  };

  const removeAchievement = (id: string) => {
    setAchievements((prev) => prev.filter((item) => item.id !== id));
  };

  const saveSkillsAndAchievements = async () => {
    await savePatch({ skills, achievements });
  };

  const avatarInitials = fullName
    .split(" ")
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("")
    .slice(0, 2);

  return (
    <section className="page-enter space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--card)] p-7 shadow-sm">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1000px_circle_at_95%_-10%,rgba(96,165,250,0.18),transparent_35%),radial-gradient(700px_circle_at_0%_120%,rgba(16,185,129,0.1),transparent_45%)]" />
        <div className="relative grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] text-lg font-bold text-[var(--text-primary)]">
              {profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profileImageUrl} alt={`${fullName} profile`} className="h-full w-full object-cover" />
              ) : (
                avatarInitials || <UserRound size={24} />
              )}
            </div>

            <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">Personal Portfolio</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">{fullName}</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{headline || "Build your student portfolio with skills, projects, and impact."}</p>
            <div className="mt-3">
              <Link
                href="/profile/edit"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3.5 py-2 text-sm font-semibold text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/45"
              >
                <PencilLine size={14} />
                Edit Profile
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-[var(--text-secondary)]">{department}</span>
              {user.role === "student" ? <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-[var(--text-secondary)]">{year}</span> : null}
              {user.role === "admin" && experience ? <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-[var(--text-secondary)]">{experience}</span> : null}
              {specialization ? <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-[var(--text-secondary)]">{specialization}</span> : null}
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 uppercase text-[var(--text-secondary)]">{user.role}</span>
            </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Skills" value={metrics.skills} icon={<UserRound size={15} />} />
            <MetricCard label="Achievements" value={metrics.achievements} icon={<Award size={15} />} />
            <MetricCard label="Technical" value={metrics.technicalSkillCount} icon={<BriefcaseBusiness size={15} />} />
            <MetricCard label="Activity" value={metrics.contributions} icon={<Save size={15} />} />
          </div>
        </div>
      </div>

      {tab === "about" ? (
      <form onSubmit={onSaveIdentity} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">About</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Update your portfolio identity and academic details.</p>
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-70"
          >
            {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
            Save Header
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Profile Image URL</span>
            <input
              value={profileImageUrl}
              onChange={(event) => setProfileImageUrl(event.target.value)}
              className="auth-input"
              placeholder="https://images.example.com/profile.jpg"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Full Name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="auth-input" required />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Headline</span>
            <input value={headline} onChange={(event) => setHeadline(event.target.value)} className="auth-input" placeholder="Aspiring software engineer" />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Department</span>
            <input value={department} onChange={(event) => setDepartment(event.target.value)} className="auth-input" required />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Year</span>
            <input value={year} onChange={(event) => setYear(event.target.value)} className="auth-input" required />
          </label>

          {user.role === "admin" ? (
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Experience</span>
              <input
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                className="auth-input"
                placeholder="10+ years in mentorship and student development"
              />
            </label>
          ) : null}

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Branch / Specialization</span>
            <input
              value={specialization}
              onChange={(event) => setSpecialization(event.target.value)}
              className="auth-input"
              placeholder="Artificial Intelligence & Data Science"
              required
            />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Bio</span>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} className="auth-input min-h-24 resize-y" placeholder="Write a short introduction about your goals and interests." />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-300">{success}</p> : null}
      </form>
      ) : null}

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm sm:p-6">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-2">
          {tabOptions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                tab === item.id ? "bg-[var(--card)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "activity" ? (
          <div className="mt-5 space-y-3">
            {activities.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)] p-4 text-sm text-[var(--text-secondary)]">
                No activity yet. Your tasks, discussions, resources, and placement actions will appear here.
              </p>
            ) : (
              activities.map((activity) => (
                <article key={activity.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{activity.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{activity.detail}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[var(--text-secondary)]">{activity.kind}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{timeAgo(activity.createdAt)}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {tab === "about" ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">About</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {bio || "Add a short profile summary to showcase your goals, interests, and impact."}
              </p>
            </article>

            <article className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Highlights</h3>
              <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                <p><span className="font-semibold text-[var(--text-primary)]">Department:</span> {department}</p>
                {user.role === "student" ? <p><span className="font-semibold text-[var(--text-primary)]">Year:</span> {year}</p> : null}
                {user.role === "admin" ? <p><span className="font-semibold text-[var(--text-primary)]">Experience:</span> {experience || "Not set"}</p> : null}
                <p><span className="font-semibold text-[var(--text-primary)]">Specialization:</span> {specialization || "Not set"}</p>
              </div>
            </article>
          </div>
        ) : null}

        {tab === "skills" ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Skills</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  value={newSkillName}
                  onChange={(event) => setNewSkillName(event.target.value)}
                  className="auth-input"
                  placeholder="Skill name"
                />
                <input
                  value={newSkillCategory}
                  onChange={(event) => setNewSkillCategory(event.target.value)}
                  className="auth-input"
                  placeholder="Category"
                />
                <label className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 text-sm text-[var(--text-secondary)]">
                  Level
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={newSkillLevel}
                    onChange={(event) => setNewSkillLevel(Number(event.target.value))}
                    className="w-full bg-transparent py-2 text-right text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={addSkill}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5"
              >
                <Plus size={14} />
                Add Skill
              </button>

              <div className="space-y-2">
                {skills.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No skills added yet.</p>
                ) : (
                  skills.map((skill) => (
                    <div key={skill.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{skill.name}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{skill.category}</p>
                        </div>
                        <button type="button" onClick={() => removeSkill(skill.id)} className="text-[var(--text-secondary)] transition-colors hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300" style={{ width: `${skill.level}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Achievements</h3>
              <input value={newAchievementTitle} onChange={(event) => setNewAchievementTitle(event.target.value)} className="auth-input" placeholder="Achievement title" />
              <input value={newAchievementIssuer} onChange={(event) => setNewAchievementIssuer(event.target.value)} className="auth-input" placeholder="Issuer / Organization" />
              <input value={newAchievementDate} onChange={(event) => setNewAchievementDate(event.target.value)} className="auth-input" placeholder="2026-03" />
              <textarea
                value={newAchievementDescription}
                onChange={(event) => setNewAchievementDescription(event.target.value)}
                className="auth-input min-h-20 resize-y"
                placeholder="Short description"
              />
              <button
                type="button"
                onClick={addAchievement}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5"
              >
                <Plus size={14} />
                Add Achievement
              </button>

              <div className="space-y-2">
                {achievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{achievement.title}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{achievement.issuer} • {achievement.date}</p>
                        {achievement.description ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{achievement.description}</p> : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAchievement(achievement.id)}
                        className="text-[var(--text-secondary)] transition-colors hover:text-red-400"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <button
                type="button"
                onClick={saveSkillsAndAchievements}
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-70"
              >
                {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                Save Skills and Achievements
              </button>
            </div>
          </div>
        ) : null}

      </section>
    </section>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
      <div className="flex items-center justify-between text-[var(--text-secondary)]">{icon}</div>
      <p className="mt-2 text-xs uppercase tracking-[0.11em] text-[var(--text-secondary)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
