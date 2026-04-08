"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookOpenCheck, GraduationCap, LoaderCircle, School, ShieldCheck } from "lucide-react";
import type { UserRole } from "@/lib/auth/types";
import { FormFieldError } from "./form-error";
import { showToast } from "./error-toast";
import { PasswordRequirements } from "./password-requirements";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
  nextPath?: string;
};

type FormState = {
  email: string;
  password: string;
  fullName: string;
  department: string;
  year: string;
  specializations: string[];
  otherSpecialization: string;
  role: UserRole;
  adminInviteCode: string;
};

const AUTH_TOKEN_STORAGE_KEY = "unisphere_auth_token";

const defaultForm: FormState = {
  email: "",
  password: "",
  fullName: "",
  department: "",
  year: "",
  specializations: [],
  otherSpecialization: "",
  role: "student",
  adminInviteCode: "",
};

const departmentOptions = ["CSE", "ECE", "IT", "EEE", "Mechanical", "Civil", "Biotech", "MBA", "MCA"];
const yearOptions = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const specializationOptions = [
  "AI & ML",
  "Data Science",
  "Web Development",
  "Mobile Development",
  "Cybersecurity",
  "Cloud Computing",
  "DevOps",
  "Blockchain",
  "Other",
];

export function AuthForm({ mode, nextPath = "/dashboard" }: AuthFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const isFormValid = useMemo(() => {
    if (!form.email.trim() || !form.password.trim()) {
      return false;
    }

    if (!isSignup) {
      return true;
    }

    const hasSpecialization =
      form.specializations.length > 0 &&
      (!form.specializations.includes("Other") || form.otherSpecialization.trim().length >= 2);
    const hasCoreProfile = form.fullName.trim() && form.department.trim() && form.year.trim() && hasSpecialization;
    const hasAdminCode = form.role === "admin" ? form.adminInviteCode.trim().length > 0 : true;
    return Boolean(hasCoreProfile && hasAdminCode);
  }, [form, isSignup]);

    const getFieldError = (field: Exclude<keyof FormState, "specializations">): string | null => {
      if (!form[field].trim()) return null;
      if (field === "email" && form.email.trim()) {
        if (!form.email.includes("@")) return "Invalid email format";
        if (form.email.length < 5) return "Email too short";
      }
      if (field === "password" && form.password.trim()) {
        if (form.password.length < 6) return "Password must be at least 6 characters";
      }
      if (field === "fullName" && form.fullName.trim() && form.fullName.length < 2) {
        return "Name must be at least 2 characters";
      }
      if (field === "otherSpecialization" && form.specializations.includes("Other") && form.otherSpecialization.trim().length > 0 && form.otherSpecialization.trim().length < 2) {
        return "Please enter at least 2 characters";
      }
      if (field === "adminInviteCode" && form.role === "admin" && form.adminInviteCode.trim()) {
        if (form.adminInviteCode.length < 8) return "Invalid invite code format";
      }
      return null;
    };
  const onChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
    setSuccess(null);
  };

  const setSpecialization = (value: string) => {
    setForm((prev) => ({
      ...prev,
      specializations: value ? [value] : [],
      otherSpecialization: value === "Other" ? prev.otherSpecialization : "",
    }));
    setError(null);
    setSuccess(null);
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isFormValid) {
      setError("Please fill all required fields");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";
    const payload = isSignup
      ? form
      : {
          email: form.email,
          password: form.password,
        };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string; message?: string; token?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Authentication failed");
      }

      if (typeof data.token === "string" && data.token.length > 0) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, data.token);
      }

      setSuccess(data.message ?? (isSignup ? "Account created" : "Login successful"));
        showToast(
          data.message ?? (isSignup ? "Account created successfully!" : "Login successful!"),
          "success"
        );
      router.push(nextPath);
      router.refresh();
    } catch (submitError) {
        const errorMessage = submitError instanceof Error ? submitError.message : "Something went wrong";
        setError(errorMessage);
        showToast(errorMessage, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-gradient px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center justify-center">
        <div className="auth-glass-card w-full rounded-3xl border border-white/30 p-7 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
            <ShieldCheck size={16} />
            UniSphere Secure Access
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{isSignup ? "Create account" : "Welcome back"}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {isSignup ? "Sign up to enter your student ecosystem." : "Log in to continue to your student workspace."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => onChange("email", event.target.value)}
                className="auth-input"
                placeholder="you@college.edu"
                required
              />
                {getFieldError("email") && <FormFieldError>{getFieldError("email")}</FormFieldError>}
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Password</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => onChange("password", event.target.value)}
                className="auth-input"
                placeholder="At least 8 characters"
                required
              />
                {getFieldError("password") && <FormFieldError>{getFieldError("password")}</FormFieldError>}
                {isSignup && form.password && <PasswordRequirements password={form.password} />}
            </label>

            {isSignup ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Full Name</span>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(event) => onChange("fullName", event.target.value)}
                    className="auth-input"
                    placeholder="Aman Sharma"
                    required
                  />
                </label>

                <fieldset className="rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/60 p-4">
                  <legend className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Academic Details</legend>

                  <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        <School size={13} /> Department
                      </span>
                      <select
                        value={form.department}
                        onChange={(event) => onChange("department", event.target.value)}
                        className="auth-input"
                        required
                      >
                        <option value="">Select department</option>
                        {departmentOptions.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        <GraduationCap size={13} /> Year
                      </span>
                      <select
                        value={form.year}
                        onChange={(event) => onChange("year", event.target.value)}
                        className="auth-input"
                        required
                      >
                        <option value="">Select year</option>
                        {yearOptions.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                        <BookOpenCheck size={13} /> Branch / Specialization
                      </span>

                      <select
                        value={form.specializations[0] ?? ""}
                        onChange={(event) => setSpecialization(event.target.value)}
                        className="auth-input"
                        required
                      >
                        <option value="">Select specialization</option>
                        {specializationOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>

                      {form.specializations.includes("Other") ? (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={form.otherSpecialization}
                            onChange={(event) => onChange("otherSpecialization", event.target.value)}
                            className="auth-input"
                            placeholder="Type your specialization"
                            required
                          />
                          {getFieldError("otherSpecialization") && <FormFieldError>{getFieldError("otherSpecialization")}</FormFieldError>}
                        </div>
                      ) : null}

                      {form.specializations.length === 0 ? <FormFieldError>Select specialization</FormFieldError> : null}
                    </label>
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Account Role</span>
                  <select
                    value={form.role}
                    onChange={(event) => onChange("role", event.target.value as UserRole)}
                    className="auth-input"
                  >
                    <option value="student">Student</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                {form.role === "admin" ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Admin Invite Code</span>
                    <input
                      type="password"
                      value={form.adminInviteCode}
                      onChange={(event) => onChange("adminInviteCode", event.target.value)}
                      className="auth-input"
                      placeholder="Enter admin invite code"
                      required
                    />
                  </label>
                ) : null}
              </>
            ) : null}

            {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                  {success}
                </div>
            ) : null}


            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {isSignup ? "Create account" : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-[var(--text-secondary)]">
            {isSignup ? "Already registered? " : "New to UniSphere? "}
            <Link
              href={isSignup ? "/login" : "/signup"}
              className="font-semibold text-[var(--text-primary)] underline-offset-4 transition-colors hover:text-[var(--accent)] hover:underline"
            >
              {isSignup ? "Log in" : "Create an account"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
