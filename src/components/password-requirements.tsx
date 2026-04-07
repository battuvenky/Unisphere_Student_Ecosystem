import { Check, X } from "lucide-react";

export const PasswordRequirements = ({ password }: { password: string }) => {
  const requirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One number", met: /[0-9]/.test(password) },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const strength =
    metCount === 4
      ? "Strong"
      : metCount >= 3
        ? "Good"
        : metCount >= 2
          ? "Fair"
          : "Weak";

  const strengthColor =
    strength === "Strong"
      ? "text-green-600"
      : strength === "Good"
        ? "text-blue-600"
        : strength === "Fair"
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-secondary)]">Password strength:</span>
        <span className={`text-xs font-semibold ${strengthColor}`}>{strength}</span>
      </div>
      <div className="space-y-1">
        {requirements.map((req, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            {req.met ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-red-400" />
            )}
            <span className={req.met ? "text-green-700 dark:text-green-200" : ""}>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
