import { createFileRoute, redirect } from "@tanstack/react-router";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const Route = createFileRoute("/api/public/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          throw redirect({ to: "/connections", search: { oauth: `error:${errorParam}` } as any });
        }
        if (!code || !state) {
          return new Response("Missing code or state", { status: 400 });
        }

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
          return new Response("Google OAuth not configured on this deployment", { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: stateRow, error: stateErr } = await supabaseAdmin
          .from("oauth_states")
          .select("user_id, provider, redirect_uri")
          .eq("state", state)
          .maybeSingle();
        if (stateErr || !stateRow) {
          return new Response("Invalid or expired state", { status: 400 });
        }
        await supabaseAdmin.from("oauth_states").delete().eq("state", state);

        const tokenRes = await fetch(TOKEN_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: stateRow.redirect_uri,
            grant_type: "authorization_code",
          }),
        });
        const tokenJson: any = await tokenRes.json();
        if (!tokenRes.ok) {
          return new Response(`Token exchange failed: ${JSON.stringify(tokenJson)}`, { status: 502 });
        }

        let email: string | null = null;
        let name: string | null = null;
        try {
          const uiRes = await fetch(USERINFO_URL, {
            headers: { Authorization: `Bearer ${tokenJson.access_token}` },
          });
          if (uiRes.ok) {
            const ui: any = await uiRes.json();
            email = ui.email ?? null;
            name = ui.name ?? null;
          }
        } catch {}

        const expiresAt = tokenJson.expires_in
          ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
          : null;

        const { error: upErr } = await supabaseAdmin.from("user_integrations").insert({
          user_id: stateRow.user_id,
          provider: "google_drive",
          account_label: name,
          account_email: email,
          access_token: tokenJson.access_token,
          refresh_token: tokenJson.refresh_token ?? null,
          token_expires_at: expiresAt,
          scope: tokenJson.scope ?? null,
          status: "connected",
          metadata: { token_type: tokenJson.token_type ?? "Bearer" },
        });
        if (upErr) {
          return new Response(`Could not save integration: ${upErr.message}`, { status: 500 });
        }

        throw redirect({ to: "/connections", search: { oauth: "google_drive:connected" } as any });
      },
    },
  },
});
