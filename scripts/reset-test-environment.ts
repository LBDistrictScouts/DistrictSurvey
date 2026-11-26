// yarn test:reset --env <local|test> [--yes]
//
// Clears every test data store: the intake, used-records, archive and results buckets, the completion
// queue and its dead-letter queue. Then switches every control back on. Refuses production.
import { DeleteObjectsCommand, ListObjectsV2Command, type S3Client } from "@aws-sdk/client-s3";
import { PurgeQueueCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { PutParameterCommand, type SSMClient } from "@aws-sdk/client-ssm";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { controlParameterName, type Controls } from "../functions/shared/controls";
import { clients, resources, testEnvironment, type TestEnvironment } from "./test-environment";

export async function emptyBucket(s3: S3Client, bucket: string): Promise<number> {
  let removed = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key! }));
    if (keys.length > 0) await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys, Quiet: true } }));
    removed += keys.length;
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

export async function resetControls(ssm: SSMClient, environment: TestEnvironment): Promise<void> {
  for (const control of ["open", "tracked", "survey", "resultsCookies"] as (keyof Controls)[]) {
    await ssm.send(new PutParameterCommand({ Name: controlParameterName(environment, control), Value: "true", Type: "String", Overwrite: true }));
  }
}

export async function reset(environment: TestEnvironment, aws = clients(environment), names = resources(environment)) {
  const counts: Record<string, number> = {};
  for (const bucket of [names.intakeBucket, names.usedRecordsBucket, names.archiveBucket, names.resultsBucket]) counts[bucket] = await emptyBucket(aws.s3, bucket);
  for (const queue of [names.completionQueueUrl, names.deadLetterQueueUrl]) await (aws.sqs as SQSClient).send(new PurgeQueueCommand({ QueueUrl: queue }));
  await resetControls(aws.ssm, environment);
  return counts;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({ options: { env: { type: "string" }, yes: { type: "boolean" } } });
  const environment = testEnvironment(values.env);
  if (environment === "test" && !values.yes) {
    console.error("This deletes every response, record and archive in the test environment. Run again with --yes to continue.");
    process.exitCode = 1;
  } else {
    reset(environment).then((counts) => {
      for (const [bucket, count] of Object.entries(counts)) console.log(`${bucket}: removed ${count} objects`);
      console.log("Purged the completion queues and switched every control on.");
    }, (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
  }
}
