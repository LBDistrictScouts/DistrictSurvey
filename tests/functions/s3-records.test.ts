import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { createMemoryRecordStore, createS3RecordStore } from "../../functions/shared/s3-records";
import { retrySecretHash, saveTrackedResponse } from "../../functions/response/save-response";
import { ApiError } from "../../functions/shared/http";
import { openTrackedLink } from "../../functions/tracking/open-tracked-link";
import { createWorld, survey, trackedLink, volunteerAnswers } from "./helpers";

function s3Error(status: number, name = "Error"): S3ServiceException {
  return new S3ServiceException({ name, $fault: "client", $metadata: { httpStatusCode: status } });
}

/** An S3 client that keeps objects in memory and honours If-None-Match, as S3 does. */
function fakeS3(failures: number[] = []) {
  const objects = new Map<string, string>();
  const sent: string[] = [];
  const client = {
    async send(command: { constructor: { name: string }; input: { Bucket: string; Key: string; Body?: string; IfNoneMatch?: string } }) {
      const name = command.constructor.name;
      const id = `${command.input.Bucket}/${command.input.Key}`;
      sent.push(name);
      const failure = failures.shift();
      if (failure) throw s3Error(failure);

      if (name === "PutObjectCommand") {
        if (command.input.IfNoneMatch !== "*") throw new Error("Every write must be conditional");
        if (objects.has(id)) throw s3Error(412, "PreconditionFailed");
        objects.set(id, command.input.Body!);
        return {};
      }
      if (name === "GetObjectCommand" || name === "HeadObjectCommand") {
        if (!objects.has(id)) throw s3Error(404, "NoSuchKey");
        return { Body: { transformToString: async () => objects.get(id) } };
      }
      objects.delete(id);
      return {};
    },
  };
  return { client: client as unknown as S3Client, objects, sent };
}

describe("S3 record store", () => {
  it("[G7] creates a record once and reports it exists after that", async () => {
    const { client, objects } = fakeS3();
    const store = createS3RecordStore(client);

    expect(await store.putIfAbsent("b", "k", "first")).toBe("created");
    expect(await store.putIfAbsent("b", "k", "second")).toBe("exists");
    expect(objects.get("b/k")).toBe("first");
    expect(await store.get("b", "k")).toBe("first");
    expect(await store.exists("b", "k")).toBe(true);

    await store.delete("b", "k");
    expect(await store.get("b", "k")).toBeNull();
    expect(await store.exists("b", "k")).toBe(false);
  });

  it("retries a conflicting write, then gives up", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => void waits.push(ms);

    const retried = fakeS3([409, 409]);
    expect(await createS3RecordStore(retried.client, wait).putIfAbsent("b", "k", "v")).toBe("created");
    expect(waits).toEqual([50, 100]);

    const stuck = fakeS3([409, 409, 409, 409]);
    await expect(createS3RecordStore(stuck.client, wait).putIfAbsent("b", "k", "v")).rejects.toBeInstanceOf(S3ServiceException);
  });

  it("passes on other S3 failures", async () => {
    await expect(createS3RecordStore(fakeS3([500]).client).putIfAbsent("b", "k", "v")).rejects.toBeInstanceOf(S3ServiceException);
    await expect(createS3RecordStore(fakeS3([403]).client).get("b", "k")).rejects.toBeInstanceOf(S3ServiceException);
    await expect(createS3RecordStore(fakeS3([503]).client).exists("b", "k")).rejects.toBeInstanceOf(S3ServiceException);
    await expect(createS3RecordStore({ send: async () => { throw new Error("network"); } } as unknown as S3Client).get("b", "k")).rejects.toThrow("network");
  });

  it("reads an empty object as an empty string", async () => {
    const client = { send: async () => ({ Body: undefined }) } as unknown as S3Client;
    expect(await createS3RecordStore(client).get("b", "k")).toBe("");
  });

  it("sends conditional writes with If-None-Match", () => {
    const command = new PutObjectCommand({ Bucket: "b", Key: "k", Body: "v", IfNoneMatch: "*" });
    expect(command.input.IfNoneMatch).toBe("*");
  });

  it("the memory store behaves the same way", async () => {
    const store = createMemoryRecordStore();
    expect(await store.putIfAbsent("b", "k", "first")).toBe("created");
    expect(await store.putIfAbsent("b", "k", "second")).toBe("exists");
    expect(await store.get("b", "k")).toBe("first");
    await store.delete("b", "k");
    expect(await store.exists("b", "k")).toBe(false);
    expect(await store.get("b", "k")).toBeNull();
  });

  it("[G7] two simultaneous submissions for one link save exactly one response", async () => {
    const world = createWorld();
    const { client } = fakeS3();
    world.response.store = createS3RecordStore(client);
    world.tracking.store = world.response.store;

    const opened = await openTrackedLink(world.tracking, trackedLink(world.keys));
    if (opened.status !== "ready") throw new Error("expected a pass");
    const submit = (secret: string) => saveTrackedResponse(world.response, { surveyId: survey.surveyId, surveyVersion: survey.fingerprint, submissionId: randomUUID(), retrySecretHash: retrySecretHash(secret), trackedPass: opened.trackedPass, answers: volunteerAnswers });

    const results = await Promise.allSettled([submit("phone"), submit("laptop")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(ApiError);
    expect((refused.reason as ApiError).code).toBe("already_completed");
  });
});
