import { randomUUID } from "node:crypto";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createS3RecordStore } from "../../functions/shared/s3-records";

// The fake S3 in s3-records.test.ts honours If-None-Match because S3 does. This checks Moto does too, so the
// browser tests' duplicate-response journeys mean something. Runs only when AWS_ENDPOINT_URL points at Moto,
// as `yarn test:stack` and the CI browser job arrange.
const endpoint = process.env.AWS_ENDPOINT_URL;
const bucket = `moto-check-${randomUUID()}`;

describe.skipIf(!endpoint)("S3 record store against Moto", () => {
  const client = new S3Client({ endpoint, region: "eu-west-1", forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } });
  const store = createS3RecordStore(client);

  // Moto may still be starting when this runs straight after `docker run -d`.
  beforeAll(async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: "eu-west-1" } }));
        return;
      } catch (error) {
        if (attempt === 30) throw error;
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }, 20_000);

  it("[G7] Moto refuses a second write to the same key", async () => {
    expect(await store.putIfAbsent(bucket, "links/one", "first")).toBe("created");
    expect(await store.putIfAbsent(bucket, "links/one", "second")).toBe("exists");
    expect(await store.get(bucket, "links/one")).toBe("first");
  });

  it("[G7] Moto lets exactly one of two simultaneous writes through", async () => {
    const results = await Promise.all([store.putIfAbsent(bucket, "links/two", "phone"), store.putIfAbsent(bucket, "links/two", "laptop")]);
    expect(results.toSorted()).toEqual(["created", "exists"]);
  });
});
