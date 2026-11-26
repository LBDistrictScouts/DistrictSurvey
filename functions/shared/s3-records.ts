import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3ServiceException, type S3Client } from "@aws-sdk/client-s3";

/**
 * Write-once records in S3. Every write uses `If-None-Match: *`, so two requests racing for the same
 * key cannot both succeed, and a retry finds what the first attempt wrote.
 */
export type RecordStore = {
  putIfAbsent(bucket: string, key: string, body: string): Promise<"created" | "exists">;
  get(bucket: string, key: string): Promise<string | null>;
  exists(bucket: string, key: string): Promise<boolean>;
  delete(bucket: string, key: string): Promise<void>;
};

function status(error: unknown): number | undefined {
  return error instanceof S3ServiceException ? error.$metadata.httpStatusCode : undefined;
}

const conflictRetries = 3;

export function createS3RecordStore(client: S3Client, wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))): RecordStore {
  return {
    async putIfAbsent(bucket, key, body) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, IfNoneMatch: "*", ContentType: "application/json" }));
          return "created";
        } catch (error) {
          // 412: the object exists. 409: another write to the same key is in progress, so try again.
          if (status(error) === 412) return "exists";
          if (status(error) !== 409 || attempt >= conflictRetries) throw error;
          await wait(50 * 2 ** attempt);
        }
      }
    },

    async get(bucket, key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return (await result.Body?.transformToString("utf8")) ?? "";
      } catch (error) {
        if (status(error) === 404) return null;
        throw error;
      }
    },

    async exists(bucket, key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (error) {
        if (status(error) === 404) return false;
        throw error;
      }
    },

    async delete(bucket, key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/** A store with the same semantics held in memory, for tests and the local stack without Moto. */
export function createMemoryRecordStore(): RecordStore & { objects: Map<string, string> } {
  const objects = new Map<string, string>();
  const id = (bucket: string, key: string) => `${bucket}/${key}`;

  return {
    objects,
    async putIfAbsent(bucket, key, body) {
      if (objects.has(id(bucket, key))) return "exists";
      objects.set(id(bucket, key), body);
      return "created";
    },
    async get(bucket, key) {
      return objects.get(id(bucket, key)) ?? null;
    },
    async exists(bucket, key) {
      return objects.has(id(bucket, key));
    },
    async delete(bucket, key) {
      objects.delete(id(bucket, key));
    },
  };
}
