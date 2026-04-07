export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ApiError(400, "Invalid request format");
  }

  const message = error instanceof Error ? error.message : "An unknown error occurred";
  return new ApiError(500, message);
};

export const apiResponse = <T,>(
  status: number,
  data?: T,
  error?: string,
) => {
  return new Response(
    JSON.stringify({
      ...(data !== undefined && { data }),
      ...(error && { error }),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
      },
    },
  );
};
