/**
 * PROMPT 8 — OAuth token exchange when provider credentials are configured.
 */
export type OAuthTokenResult = {
  accessToken: string;
  refreshToken?: string;
  scopes?: string[];
  accountIdentifier?: string;
};

async function postForm(url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      `OAuth exchange failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`,
    );
  }
  return json;
}

export async function exchangeOAuthCode(
  integrationType: string,
  code: string,
): Promise<OAuthTokenResult | null> {
  switch (integrationType) {
    case "google-calendar":
    case "google-fit": {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      const redirectUri = process.env.GOOGLE_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) return null;
      const json = await postForm("https://oauth2.googleapis.com/token", {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });
      return {
        accessToken: String(json.access_token ?? ""),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        scopes: typeof json.scope === "string" ? json.scope.split(" ") : [],
      };
    }
    case "slack": {
      const clientId = process.env.SLACK_CLIENT_ID;
      const clientSecret = process.env.SLACK_CLIENT_SECRET;
      const redirectUri = process.env.SLACK_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) return null;
      const json = await postForm("https://slack.com/api/oauth.v2.access", {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      });
      const authed = json.authed_user as { id?: string } | undefined;
      return {
        accessToken: String(json.access_token ?? ""),
        accountIdentifier: authed?.id ?? String(json.user_id ?? ""),
        scopes: typeof json.scope === "string" ? json.scope.split(",") : [],
      };
    }
    case "discord": {
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;
      const redirectUri = process.env.DISCORD_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) return null;
      const json = await postForm("https://discord.com/api/oauth2/token", {
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      });
      return {
        accessToken: String(json.access_token ?? ""),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        accountIdentifier: String(json.user_id ?? ""),
        scopes: typeof json.scope === "string" ? json.scope.split(" ") : [],
      };
    }
    case "linkedin": {
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) return null;
      const json = await postForm("https://www.linkedin.com/oauth/v2/accessToken", {
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      });
      return {
        accessToken: String(json.access_token ?? ""),
        scopes: typeof json.scope === "string" ? json.scope.split(" ") : [],
      };
    }
    case "twitter": {
      const clientId = process.env.TWITTER_CLIENT_ID;
      const clientSecret = process.env.TWITTER_CLIENT_SECRET;
      const redirectUri = process.env.TWITTER_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) return null;
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code_verifier: process.env.TWITTER_CODE_VERIFIER ?? "challenge",
        }),
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) return null;
      return {
        accessToken: String(json.access_token ?? ""),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
      };
    }
    default:
      return null;
  }
}
