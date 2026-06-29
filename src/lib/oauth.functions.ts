import { createServerFn } from "@tanstack/react-start";
import { getRequestHost } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";

type Provider = "google_drive" | "onedrive" | "sharepoint";

interface ProviderConfig {
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  scope: string;
  extraParams?: Record<string, string>;
  callbackPath: string;
}

const PROVIDERS: Record<Provider, ProviderConfig> = {
  google_drive: {
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scope:
      "openid email profile https://www.googleapis.com/auth/drive.readonly",
    extraParams: { access_type: "offline", prompt: "consent" },
    callbackPath: "/api/public/oauth/google/callback",
  },
  onedrive: {
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    scope:
      "openid email profile offline_access User.Read Files.Read Files.Read.All",
    callbackPath: "/api/public/oauth/microsoft/callback",
  },
  sharepoint: {
    clientIdEnv: "MICROSOFT_OAUTH_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_OAUTH_CLIENT_SECRET",
    authUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    scope:
      "openid email profile offline_access User.Read Sites.Read.All Files.Read.All",
    callbackPath: "/api/public/oauth/microsoft/callback",
  },
};

function originFromHost(host: string) {
  // localhost/dev uses http, everything else https
  const protocol = host.startsWith("localhost") || host.startsWith("127.")
    ? "http"
    : "https";
  return `${protocol}://${host}`;
}

export const startOAuthFlow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { provider: Provider }) => {
    if (!["google_drive", "onedrive", "sharepoint"].includes(input.provider)) {
      throw new Error("Invalid provider");
    }
    return input;
  })
  .handler(async ({ data, context }) => {
    const cfg = PROVIDERS[data.provider];
    const clientId = process.env[cfg.clientIdEnv];
    if (!clientId) {
      return {
        ok: false as const,
        error: `${cfg.clientIdEnv} is not configured for this deployment. The workspace admin must register the OAuth app and add the client ID + secret.`,
      };
    }

    const host = getRequestHost();
    const origin = originFromHost(host);
    const redirectUri = `${origin}${cfg.callbackPath}`;

    const state = randomBytes(24).toString("hex");

    const { error: stateErr } = await context.supabase
      .from("oauth_states")
      .insert({
        state,
        user_id: context.userId,
        provider: data.provider,
        redirect_uri: redirectUri,
      });
    if (stateErr) {
      return { ok: false as const, error: stateErr.message };
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: cfg.scope,
      state,
      ...(cfg.extraParams ?? {}),
    });

    return {
      ok: true as const,
      authorizeUrl: `${cfg.authUrl}?${params.toString()}`,
    };
  });
