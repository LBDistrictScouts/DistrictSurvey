import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildFunctions } from "../../scripts/build-functions.mjs";
import { buildData } from "./helpers";

describe("bundle separation", () => {
  let response = "";
  let tracking = "";

  beforeAll(async () => {
    const outdir = mkdtempSync(join(tmpdir(), "survey-functions-"));
    const outputs = await buildFunctions(outdir, buildData, "test-build");
    response = readFileSync(outputs.response!, "utf8");
    tracking = readFileSync(outputs.tracking!, "utf8");
  }, 60_000);

  it("[G6] the response Lambda contains no tracking code or tracking secrets", () => {
    for (const marker of ["tracked-link-key", "link-reference-key", "receipt-record-key", "tracked-pass-private-key", "results-token-private-key", "cloudfront-cookie-private-key", "/api/v1/tracking/", "SendMessageCommand", "inviteUuid"]) {
      expect(response, marker).not.toContain(marker);
    }
    expect(response).toContain(buildData.compiled.fingerprint);
  });

  it("[G6] the tracking Lambda contains no response code, survey questions or answer storage", () => {
    for (const marker of ["file-name-key", "receipt-private-key", "intake/answers", "intake/comments", "/api/v1/responses/", "challenges.cloudflare.com", buildData.compiled.fingerprint, "How supported do you feel"]) {
      expect(tracking, marker).not.toContain(marker);
    }
    expect(tracking).toContain("/api/v1/tracking/open");
  });
});
