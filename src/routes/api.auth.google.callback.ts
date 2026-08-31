import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeGoogleSignIn } = await import("@/lib/google-auth.server");
        return completeGoogleSignIn(request.url);
      },
    },
  },
});
