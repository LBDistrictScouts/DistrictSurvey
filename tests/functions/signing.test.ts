import { createHmac, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import fc from "fast-check";
import { base64url, ed25519PrivateKey, ed25519PublicKey, hmacKey, hmacName, linkRef, receiptPayload, resultsTokenPayload, SignedValueError, signEd25519, signHmac, trackedLinkPayload, trackedPassPayload, verifyReceipt, verifyResultsToken, verifyTrackedLink, verifyTrackedPass } from "../../functions/shared/signing";

const survey = "example-2027";
const now = 1_806_000_000;
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const hmac = randomBytes(32);

function reason(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof SignedValueError) return error.message;
    throw error;
  }
  return "accepted";
}

describe("tracked link tokens", () => {
  it("accept a token signed with the tracked link key", () => {
    const uuid = randomUUID();
    expect(verifyTrackedLink(hmac, signHmac(hmac, { v: 1, s: survey, u: uuid }), survey)).toEqual({ v: 1, s: survey, u: uuid });
  });

  it("refuse forged, altered, other-survey and malformed tokens", () => {
    const token = signHmac(hmac, { v: 1, s: survey, u: randomUUID() });
    const [payload, signature] = token.split(".") as [string, string];
    const altered = `${base64url(JSON.stringify({ v: 1, s: survey, u: randomUUID() }))}.${signature}`;

    expect(reason(() => verifyTrackedLink(randomBytes(32), token, survey))).toBe("signature");
    expect(reason(() => verifyTrackedLink(hmac, altered, survey))).toBe("signature");
    expect(reason(() => verifyTrackedLink(hmac, signHmac(hmac, { v: 1, s: "other", u: randomUUID() }), survey))).toBe("survey");
    expect(reason(() => verifyTrackedLink(hmac, signHmac(hmac, { v: 1, s: survey, u: randomUUID(), extra: 1 }), survey))).toBe("payload");
    expect(reason(() => verifyTrackedLink(hmac, `${base64url("not json")}.${base64url(Buffer.alloc(32))}`.replace(/^[^.]+/, (part) => part), survey))).toBe("signature");
    expect(reason(() => verifyTrackedLink(hmac, `${payload}.${signature}.x`, survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, `${payload}.${signature.slice(1)}`, survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, `${payload}!.${signature}`, survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, `${payload}.${signature}`.padEnd(700, "A"), survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, "", survey))).toBe("format");
  });

  it("refuse a correctly signed payload that is not JSON", () => {
    const encoded = base64url("{nope");
    const signature = base64url(createHmac("sha256", hmac).update(encoded).digest());
    expect(reason(() => verifyTrackedLink(hmac, `${encoded}.${signature}`, survey))).toBe("payload");
  });

  it("refuse any change to a signed token", () => {
    const token = signHmac(hmac, { v: 1, s: survey, u: randomUUID() });
    fc.assert(fc.property(fc.nat({ max: token.length - 1 }), fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"), (index, character) => {
      fc.pre(token[index] !== character && token[index] !== ".");
      const changed = token.slice(0, index) + character + token.slice(index + 1);
      expect(reason(() => verifyTrackedLink(hmac, changed, survey))).not.toBe("accepted");
    }));
  });
});

describe("Ed25519 values", () => {
  const pass = { v: 1, s: survey, l: "L".repeat(43), exp: now + 60 };
  const receipt = { v: 1, s: survey, r: "r".repeat(22), exp: now + 60 };
  const results = { v: 1, s: survey, a: "volunteer", exp: now + 60 };

  it("accept values signed with the matching key before they expire", () => {
    expect(verifyTrackedPass(publicKey, signEd25519(privateKey, pass), survey, now)).toEqual(pass);
    expect(verifyReceipt(publicKey, signEd25519(privateKey, receipt), survey, now)).toEqual(receipt);
    expect(verifyResultsToken(publicKey, signEd25519(privateKey, results), survey, now)).toEqual(results);
  });

  it("refuse expired, wrongly signed, other-survey and mixed-up values", () => {
    const other = generateKeyPairSync("ed25519");
    expect(reason(() => verifyTrackedPass(publicKey, signEd25519(privateKey, pass), survey, now + 60))).toBe("expired");
    expect(reason(() => verifyTrackedPass(publicKey, signEd25519(other.privateKey, pass), survey, now))).toBe("signature");
    expect(reason(() => verifyTrackedPass(publicKey, signEd25519(privateKey, { ...pass, s: "other" }), survey, now))).toBe("survey");
    expect(reason(() => verifyTrackedPass(publicKey, signEd25519(privateKey, receipt), survey, now))).toBe("payload");
    expect(reason(() => verifyResultsToken(publicKey, signEd25519(privateKey, { ...results, a: "analyst" }), survey, now))).toBe("payload");
    expect(reason(() => verifyReceipt(publicKey, signHmac(hmac, receipt), survey, now))).toBe("format");
  });
});

describe("keys and names", () => {
  it("read keys and refuse the wrong kind", () => {
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    expect(ed25519PrivateKey(pem).asymmetricKeyType).toBe("ed25519");
    expect(ed25519PublicKey(publicPem).asymmetricKeyType).toBe("ed25519");

    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
    expect(() => ed25519PrivateKey(rsa.privateKey.export({ type: "pkcs8", format: "pem" }).toString())).toThrow("Ed25519 private");
    expect(() => ed25519PublicKey(rsa.publicKey.export({ type: "spki", format: "pem" }).toString())).toThrow("Ed25519 public");

    expect(hmacKey(` ${randomBytes(32).toString("base64")}\n`)).toHaveLength(32);
    expect(() => hmacKey(randomBytes(16).toString("base64"))).toThrow("at least 32 bytes");
  });

  it("link references and file names are one-way, stable and 43 characters", () => {
    const uuid = randomUUID();
    expect(linkRef(hmac, survey, uuid)).toBe(linkRef(hmac, survey, uuid));
    expect(linkRef(hmac, survey, uuid)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(linkRef(hmac, survey, uuid)).not.toBe(linkRef(hmac, "other", uuid));
    expect(linkRef(hmac, survey, uuid)).not.toContain(uuid.slice(0, 8));
    expect(hmacName(hmac, "a")).not.toBe(hmacName(randomBytes(32), "a"));
  });
});

describe("payload formats", () => {
  const cases: [string, { safeParse: (value: unknown) => { success: boolean } }, object, object[]][] = [
    ["tracked link", trackedLinkPayload, { v: 1, s: "example-2027", u: randomUUID() }, [{ v: 1, s: "example-2027" }, { v: 1, s: "example-2027", u: "x" }]],
    ["tracked pass", trackedPassPayload, { v: 1, s: "a", l: "L".repeat(43), exp: 1_700_000_000 }, [{ v: 1, s: "a", l: "L".repeat(42), exp: now }, { v: 1, s: "a", l: "L".repeat(44), exp: now }, { v: 1, s: "a", l: `!${"L".repeat(42)}`, exp: now }, { v: 1, s: "a", l: `${"L".repeat(42)}!`, exp: now }, { v: 1, s: "a", l: "L".repeat(43), exp: 1_699_999_999 }, { v: 1, s: "a", l: "L".repeat(43), exp: 4_102_444_801 }, { v: 1, s: "a", l: "L".repeat(43), exp: now + 0.5 }]],
    ["receipt", receiptPayload, { v: 1, s: "a", r: "r".repeat(22), exp: 4_102_444_800 }, [{ v: 1, s: "a", r: "r".repeat(21), exp: now }, { v: 1, s: "a", r: "r".repeat(23), exp: now }, { v: 1, s: "a", r: `${"r".repeat(21)}=`, exp: now }]],
    ["results token", resultsTokenPayload, { v: 1, s: "a", a: "volunteer", exp: now }, [{ v: 1, s: "a", exp: now }]],
  ];

  it.each(cases)("%s payloads accept only their own shape", (_, schema, valid, invalid) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ ...valid, v: 2 }).success).toBe(false);
    expect(schema.safeParse({ ...valid, extra: true }).success).toBe(false);
    for (const value of invalid) expect(schema.safeParse(value).success, JSON.stringify(value)).toBe(false);
  });

  it("survey IDs are lower-case words of up to 64 characters", () => {
    const payload = (s: string) => ({ v: 1, s, u: randomUUID() });
    for (const s of ["a", "example-2027", `a${"b".repeat(63)}`]) expect(trackedLinkPayload.safeParse(payload(s)).success, s).toBe(true);
    for (const s of ["", "-a", "Ab", "a_b", `a${"b".repeat(64)}`, "ab!", "!ab", "a b"]) expect(trackedLinkPayload.safeParse(payload(s)).success, s).toBe(false);
  });
});

describe("signed value framing", () => {
  it("allows values up to 600 characters", () => {
    const [encoded, signature] = signHmac(hmac, { v: 1, s: survey, u: randomUUID() }).split(".") as [string, string];
    const at600 = `${encoded}${"A".repeat(600 - encoded.length - signature.length - 1)}.${signature}`;
    expect(at600).toHaveLength(600);
    expect(reason(() => verifyTrackedLink(hmac, at600, survey))).toBe("signature");
    expect(reason(() => verifyTrackedLink(hmac, `A${at600}`, survey))).toBe("format");
  });

  it("refuses characters outside base64url before and after each part, and non-canonical signatures", () => {
    const token = signHmac(hmac, { v: 1, s: survey, u: randomUUID() });
    const [encoded, signature] = token.split(".") as [string, string];
    expect(reason(() => verifyTrackedLink(hmac, `!${encoded}.${signature}`, survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, `${encoded}.!${signature.slice(1)}`, survey))).toBe("format");
    expect(reason(() => verifyTrackedLink(hmac, `${encoded}.${signature.slice(0, -1)}!`, survey))).toBe("format");

    // The last character of a 32-byte signature carries 2 unused bits. Setting them gives the same bytes.
    const last = signature.at(-1)!;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const sibling = alphabet[alphabet.indexOf(last) ^ 1]!;
    expect(Buffer.from(signature.slice(0, -1) + sibling, "base64url")).toEqual(Buffer.from(signature, "base64url"));
    expect(reason(() => verifyTrackedLink(hmac, `${encoded}.${signature.slice(0, -1)}${sibling}`, survey))).toBe("format");
  });

  it("names its errors", () => {
    expect(new SignedValueError("format").name).toBe("SignedValueError");
  });

  it("refuses an Ed25519 payload that is not JSON", () => {
    const encoded = base64url("{nope");
    const value = `${encoded}.${base64url(sign(null, Buffer.from(encoded), privateKey))}`;
    expect(reason(() => verifyReceipt(publicKey, value, survey, now))).toBe("payload");
  });

  it("trims whitespace around stored HMAC keys", () => {
    const raw = randomBytes(32);
    expect(hmacKey(` ${raw.toString("base64")} \n`)).toEqual(raw);
  });
});
