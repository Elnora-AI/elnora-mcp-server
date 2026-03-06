import axios from "axios";

export function handleApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as { errorCode?: string; messages?: string[] } | undefined;
      const messages = data?.messages?.join(", ") || "";

      switch (status) {
        case 400:
          return `Error: Invalid request. ${messages || "Check your parameters."}`;
        case 401:
          return "Error: Authentication failed. Your token may have expired — re-authenticate.";
        case 403:
          return "Error: Permission denied. You don't have access to this resource.";
        case 404:
          return `Error: Resource not found. ${messages || "Check the ID is correct."}`;
        case 429:
          return "Error: Rate limit exceeded. Please wait before making more requests.";
        default:
          return `Error: API request failed (${status}). ${messages}`;
      }
    } else if (error.code === "ECONNABORTED") {
      return "Error: Request timed out. The operation may still be in progress.";
    } else if (error.code === "ECONNREFUSED") {
      return "Error: Service temporarily unavailable. Please try again later.";
    }
  }
  return `Error: Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
}
