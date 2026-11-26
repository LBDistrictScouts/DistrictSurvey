// Cloudflare Turnstile checks for open-link submissions.

export const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileOutcome = "accepted" | "rejected" | "unavailable";

export type TurnstileVerifier = (token: string, idempotencyKey: string) => Promise<TurnstileOutcome>;

type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/**
 * Asks Cloudflare whether a token is valid. The respondent's IP address is deliberately not sent.
 * Each retry of a submission brings a new token, but shares the submission ID as the idempotency key.
 */
export function createTurnstileVerifier(secret: () => Promise<string>, expectedHostname: string | undefined, fetcher: Fetch = fetch, url = siteverifyUrl): TurnstileVerifier {
  return async (token, idempotencyKey) => {
    let body: { success?: boolean; hostname?: string };

    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: await secret(), response: token, idempotency_key: idempotencyKey }).toString(),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return "unavailable";
      body = await response.json();
    } catch {
      return "unavailable";
    }

    if (body.success !== true) return "rejected";
    // Cloudflare's test keys report "example.com", so the hostname check is skipped when none is configured.
    if (expectedHostname && body.hostname !== expectedHostname) return "rejected";
    return "accepted";
  };
}
