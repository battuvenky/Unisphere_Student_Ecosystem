"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Database,
  GraduationCap,
  MessageSquare,
  ShieldCheck,
  Users,
  Globe,
  Send,
  Mail,
} from "lucide-react";

const features = [
  {
    title: "Academic Resource Hub",
    description: "Centralized notes, PYQs, curated links, and downloads organized by subject and semester.",
    icon: Database,
  },
  {
    title: "Doubt & Discussion System",
    description: "Ask, answer, and upvote with structured threads so students learn collaboratively.",
    icon: MessageSquare,
  },
  {
    title: "Placement Tracker",
    description: "Track opportunities, application stages, and interview progress in one clear workflow.",
    icon: Briefcase,
  },
  {
    title: "Study Groups & Chat",
    description: "Create focused groups, share resources, and communicate in real-time channels.",
    icon: Users,
  },
  {
    title: "AI-Powered Assistant",
    description: "Get guidance for doubts, better question framing, and smart answer direction instantly.",
    icon: Bot,
  },
  {
    title: "Secure Student Workspace",
    description: "Role-based access, safe authentication, and reliable data flow for everyday campus use.",
    icon: ShieldCheck,
  },
];

const steps = [
  {
    title: "Create Your Workspace",
    description: "Sign up, set your academic details, and personalize your student profile.",
  },
  {
    title: "Collaborate and Track",
    description: "Use resources, doubts, groups, tasks, and placements from one connected dashboard.",
  },
  {
    title: "Grow with Insights",
    description: "Leverage analytics and AI suggestions to improve learning consistency and outcomes.",
  },
];

const testimonials = [
  {
    name: "Ananya Sharma",
    role: "CSE, 3rd Year",
    quote:
      "UniSphere reduced my app-switching completely. Doubts, notes, tasks, and placement prep are all in one flow.",
  },
  {
    name: "Rahul Verma",
    role: "IT, 4th Year",
    quote:
      "The placement tracker and study groups changed my final-year routine. It feels like a proper startup product.",
  },
  {
    name: "Dr. Kavya Menon",
    role: "Student Success Lead",
    quote:
      "From mentorship to campus updates, UniSphere helps us support students with more clarity and speed.",
  },
];

export function UniSphereLanding() {
  useEffect(() => {
    const revealItems = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (revealItems.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.16, rootMargin: "0px 0px -50px 0px" }
    );

    for (const item of revealItems) {
      observer.observe(item);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-root min-h-screen text-[var(--text-primary)]">
      <div className="landing-gradient-orb orb-left" aria-hidden="true" />
      <div className="landing-gradient-orb orb-right" aria-hidden="true" />

      <header className="landing-nav sticky top-0 z-50 border-b border-white/35 bg-white/55 backdrop-blur-xl dark:bg-[#0c1626]/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-3 md:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-base font-bold tracking-tight">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-white">U</span>
            UniSphere
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--text-secondary)] md:flex">
            <a href="#features" className="hover:text-[var(--text-primary)]">Features</a>
            <a href="#how" className="hover:text-[var(--text-primary)]">How it works</a>
            <a href="#testimonials" className="hover:text-[var(--text-primary)]">Testimonials</a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-xl border border-[var(--border)] bg-white/60 px-3 py-2 text-sm font-semibold hover:scale-[1.02]">
              Login
            </Link>
            <Link href="/signup" className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_-14px_rgba(47,111,237,0.9)] hover:scale-[1.03]">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-14 pt-10 md:grid-cols-[1.1fr_0.9fr] md:px-8 md:pt-16">
          <div data-reveal className="reveal-item space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/70 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              <GraduationCap size={14} /> Student Life Ecosystem
            </span>

            <h1 className="text-4xl font-black leading-tight tracking-tight md:text-6xl">
              One Platform. Every Student Need.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
              UniSphere unifies academics, collaboration, placement prep, and AI support into one premium workspace built for modern student life.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-16px_rgba(47,111,237,0.85)] hover:scale-[1.04] hover:shadow-[0_20px_44px_-14px_rgba(47,111,237,0.95)]">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/75 px-5 py-3 text-sm font-semibold hover:scale-[1.03]">
                Login
              </Link>
              <a href="#features" className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-transparent px-5 py-3 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Explore
              </a>
            </div>
          </div>

          <div data-reveal className="reveal-item">
            <div className="landing-glass-card relative overflow-hidden rounded-3xl border border-white/45 p-4 shadow-[0_24px_60px_-28px_rgba(20,30,56,0.7)]">
              <div className="floating-chip chip-one">Live groups</div>
              <div className="floating-chip chip-two">AI answers</div>

              <div className="rounded-2xl border border-white/45 bg-white/85 p-4 backdrop-blur dark:bg-[#0d1827]/80">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold">UniSphere Dashboard</p>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                    Real-time
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">Pending tasks</p>
                    <p className="mt-1 text-2xl font-bold">12</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                    <p className="text-xs text-[var(--text-secondary)]">Active discussions</p>
                    <p className="mt-1 text-2xl font-bold">29</p>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 sm:col-span-2">
                    <p className="text-xs text-[var(--text-secondary)]">Placement progress</p>
                    <div className="mt-2 h-2 rounded-full bg-[var(--bg-muted)]">
                      <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" />
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[var(--text-secondary)]">72% profile completion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
          <div data-reveal className="reveal-item mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Features</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Everything Students Need, Connected</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  data-reveal
                  className="reveal-item landing-feature-card rounded-2xl border border-[var(--border)] bg-white/80 p-5 shadow-[0_16px_35px_-24px_rgba(14,24,44,0.55)] backdrop-blur"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent)]/12 text-[var(--accent)]">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="how" className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
          <div data-reveal className="reveal-item mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Three Steps to Academic Momentum</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} data-reveal className="reveal-item rounded-2xl border border-[var(--border)] bg-white/80 p-5 backdrop-blur">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{step.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="testimonials" className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
          <div data-reveal className="reveal-item mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Testimonials</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Students Love the Flow</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((item) => (
              <article key={item.name} data-reveal className="reveal-item rounded-2xl border border-[var(--border)] bg-white/85 p-5 backdrop-blur">
                <p className="text-sm leading-relaxed text-[var(--text-secondary)]">"{item.quote}"</p>
                <p className="mt-4 text-sm font-semibold">{item.name}</p>
                <p className="text-xs text-[var(--text-secondary)]">{item.role}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto mt-8 w-full max-w-6xl border-t border-[var(--border)] px-5 py-8 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          <div>
            <p className="text-lg font-bold">UniSphere</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">The premium student operating layer for campus life, growth, and placement success.</p>
          </div>

          <div>
            <p className="text-sm font-semibold">Quick Links</p>
            <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
              <p><a href="#features" className="hover:text-[var(--text-primary)]">Features</a></p>
              <p><a href="#how" className="hover:text-[var(--text-primary)]">How it works</a></p>
              <p><Link href="/signup" className="hover:text-[var(--text-primary)]">Get Started</Link></p>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">Contact</p>
            <div className="mt-2 flex items-center gap-3 text-[var(--text-secondary)]">
              <a href="mailto:hello@unisphere.app" aria-label="Email" className="rounded-lg border border-[var(--border)] p-2 hover:text-[var(--text-primary)]"><Mail size={16} /></a>
              <a href="#" aria-label="Website" className="rounded-lg border border-[var(--border)] p-2 hover:text-[var(--text-primary)]"><Globe size={16} /></a>
              <a href="#" aria-label="Community" className="rounded-lg border border-[var(--border)] p-2 hover:text-[var(--text-primary)]"><Send size={16} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
