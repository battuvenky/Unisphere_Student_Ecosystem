export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
};

type ErrorPayload = {
  error?: string;
  message?: string;
};

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiFetchJson<T>(
  input: RequestInfo | URL,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { timeoutMs = 12000, signal, ...init } = options;

  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const abortListener = () => timeoutController.abort();
  if (signal) {
    signal.addEventListener("abort", abortListener, { once: true });
  }

  try {
    const response = await fetch(input, {
      ...init,
      signal: timeoutController.signal,
    });

    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      const data = payload as ErrorPayload | null;
      const message = data?.error ?? data?.message ?? `Request failed with status ${response.status}`;
      throw new ApiError(message, response.status);
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timed out", 408);
    }

    throw new ApiError("Network error", 503);
  } finally {
    clearTimeout(timer);
    if (signal) {
      signal.removeEventListener("abort", abortListener);
    }
  }
}
