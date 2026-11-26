import { post, postOnce, resultsAccessUrl, surveyApi } from "@/lib/client/api";

function fetcher(responses: (Response | Error)[]) {
  const bodies: unknown[] = [];
  const fetch = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    const next = responses.shift()!;
    if (next instanceof Error) throw next;
    return next;
  }) as typeof globalThis.fetch;
  return { fetch, bodies };
}

const json = (status: number, body: object) => new Response(JSON.stringify(body), { status });
const noWait = async () => undefined;

describe("API client", () => {
  it("[G3] retries failed connections and temporary errors with the same submission ID", async () => {
    const { fetch, bodies } = fetcher([new Error("offline"), json(503, { error: "temporarily_unavailable" }), json(429, {}), json(200, { status: "saved" })]);
    let token = 0;
    const result = await surveyApi.saveOpenResponse({ surveyId: "s", surveyVersion: "v", submissionId: "same", answers: {} }, async () => `token-${++token}`, { fetcher: fetch, wait: noWait });
    expect(result).toEqual({ ok: true, data: { status: "saved" } });
    expect(bodies.map((body) => (body as { submissionId: string }).submissionId)).toEqual(["same", "same", "same", "same"]);
    expect(bodies.map((body) => (body as { turnstileToken: string }).turnstileToken)).toEqual(["token-1", "token-2", "token-3", "token-4"]);
  });

  it("does not retry errors the person must act on, and gives up after the last attempt", async () => {
    const refused = fetcher([json(422, { error: "invalid_answers", questionIds: ["q"] })]);
    expect(await post("/x", () => ({}), { fetcher: refused.fetch, wait: noWait })).toEqual({ ok: false, code: "invalid_answers", questionIds: ["q"] });

    const down = fetcher([json(503, {}), json(503, {})]);
    expect(await post("/x", () => ({}), { fetcher: down.fetch, wait: noWait, attempts: 2 })).toEqual({ ok: false, code: "temporarily_unavailable", questionIds: undefined });
  });

  it("treats unknown error codes and unreadable bodies as temporarily unavailable", async () => {
    expect(await postOnce("/x", {}, { fetcher: fetcher([json(500, { error: "secret detail" })]).fetch })).toMatchObject({ ok: false, code: "temporarily_unavailable" });
    expect(await postOnce("/x", {}, { fetcher: fetcher([new Response("not json", { status: 502 })]).fetch })).toMatchObject({ ok: false, code: "temporarily_unavailable" });
  });

  it("calls every tracking route", async () => {
    const { fetch, bodies } = fetcher(Array.from({ length: 6 }, () => json(200, { status: "ok" })));
    const options = { fetcher: fetch, wait: noWait };
    await surveyApi.openTrackedLink("t", options);
    await surveyApi.startTrackedLink("t", options);
    await surveyApi.completeTrackedLink("t", options);
    await surveyApi.claimReceipt("t", "r", options);
    await surveyApi.declineTrackedLink("t", options);
    await surveyApi.saveTrackedResponse({ surveyId: "s", surveyVersion: "v", submissionId: "i", retrySecretHash: "h", trackedPass: "p", answers: {} }, options);
    expect(bodies).toHaveLength(6);
    expect(bodies[3]).toEqual({ token: "t", receipt: "r" });
  });

  it("[G10] builds the results access link with the token in the fragment", () => {
    expect(resultsAccessUrl("https://results.example.org/", "a.b")).toBe("https://results.example.org/access#token=a.b");
  });
});
