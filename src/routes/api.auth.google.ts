import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/google")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const { googleAuthorizationUrl } = await import("@/lib/google-auth.server");
        return Response.redirect(googleAuthorizationUrl(origin), 302);
      },
    },
  },
});
