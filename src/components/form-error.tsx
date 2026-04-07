import { AlertCircle } from "lucide-react";
import { ReactNode } from "react";

export const FormError = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2 mt-1.5 text-sm text-red-600">
    <AlertCircle className="w-4 h-4 flex-shrink-0" />
    <span>{children}</span>
  </div>
);

export const FormSuccess = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center gap-2 mt-1.5 text-sm text-green-600">
    <div className="w-4 h-4 rounded-full bg-green-600 flex items-center justify-center text-white text-xs flex-shrink-0">
      ✓
    </div>
    <span>{children}</span>
  </div>
);

export const FormFieldError = ({
  error,
  children,
}: {
  error?: string;
  children: ReactNode;
}) => (
  <div>
    {children}
    {error && <FormError>{error}</FormError>}
  </div>
);
