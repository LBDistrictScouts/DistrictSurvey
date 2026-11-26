import { createTurnstileVerifier, siteverifyUrl } from "../../functions/response/turnstile";

function fetcher(response: Response | Error) {
  const calls: { url: string; body: string }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body) });
    if (response instanceof Error) throw response;
    return response;
  };
  return { fetch, calls };
}

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Turnstile", () => {
  it("accepts a valid token for the survey hostname, without sending the respondent's IP address", async () => {
    const { fetch, calls } = fetcher(json({ success: true, hostname: "survey.example.org" }));
    const verify = createTurnstileVerifier(async () => "secret", "survey.example.org", fetch);

    expect(await verify("token", "submission-1")).toBe("accepted");
    expect(calls[0]!.url).toBe(siteverifyUrl);
    expect(Object.fromEntries(new URLSearchParams(calls[0]!.body))).toEqual({ secret: "secret", response: "token", idempotency_key: "submission-1" });
  });

  it("rejects failed tokens and tokens for another hostname", async () => {
    expect(await createTurnstileVerifier(async () => "s", undefined, fetcher(json({ success: false })).fetch)("t", "i")).toBe("rejected");
    expect(await createTurnstileVerifier(async () => "s", "survey.example.org", fetcher(json({ success: true, hostname: "evil.example" })).fetch)("t", "i")).toBe("rejected");
    expect(await createTurnstileVerifier(async () => "s", undefined, fetcher(json({ success: true, hostname: "example.com" })).fetch)("t", "i")).toBe("accepted");
  });

  it("reports Cloudflare failures as unavailable", async () => {
    expect(await createTurnstileVerifier(async () => "s", undefined, fetcher(new Error("offline")).fetch)("t", "i")).toBe("unavailable");
    expect(await createTurnstileVerifier(async () => "s", undefined, fetcher(json({}, 500)).fetch)("t", "i")).toBe("unavailable");
    expect(await createTurnstileVerifier(async () => "s", undefined, fetcher(new Response("not json")).fetch)("t", "i")).toBe("unavailable");
  });
});
