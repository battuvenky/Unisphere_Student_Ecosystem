"use client";

import { AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info";

type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

let toastId = 0;
let listeners: Set<(toast: Toast) => void> = new Set();

export const showToast = (message: string, type: ToastType = "info", duration = 4000) => {
  const id = `toast-${++toastId}`;
  const toast: Toast = { id, type, message, duration };
  listeners.forEach((listener) => listener(toast));
  return id;
};

export const ErrorToastContainer = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleNewToast = (toast: Toast) => {
      setToasts((prev) => [...prev, toast]);
      if (toast.duration) {
        setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
      }
    };

    listeners.add(handleNewToast);
    return () => {
      listeners.delete(handleNewToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm
            pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-300
            ${
              toast.type === "success"
                ? "bg-green-50/95 border border-green-200 text-green-800"
                : toast.type === "error"
                  ? "bg-red-50/95 border border-red-200 text-red-800"
                  : "bg-blue-50/95 border border-blue-200 text-blue-800"
            }
          `}
        >
          <div className="mt-0.5 flex-shrink-0">
            {toast.type === "success" && (
              <CheckCircle className="w-5 h-5 text-green-600" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            {toast.type === "info" && (
              <Info className="w-5 h-5 text-blue-600" />
            )}
          </div>
          <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 text-current hover:opacity-70 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
