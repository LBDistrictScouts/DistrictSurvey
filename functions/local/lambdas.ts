// Builds both Lambdas for local development and the pull request test stack, with the same code as
// the deployed functions. Storage is DistrictWorkflow's Moto, or memory when LOCAL_STORE=memory.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { CloudWatchClient } from "@aws-sdk/client-cloudwatch";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { CreateQueueCommand, GetQueueUrlCommand, SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { PutParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createSsmControls, fixedControls, controlParameterName, type Controls } from "../shared/controls";
import { createCloudWatchMetrics, type MetricSink } from "../shared/metrics";
import { createMemoryRecordStore, createS3RecordStore, type RecordStore } from "../shared/s3-records";
import { createFileSecretSource, parseOriginValues } from "../shared/secrets";
import type { CompletionMessage } from "../tracking/context";
import { createResponseLambda } from "../response/handler";
import { createTrackingLambda } from "../tracking/handler";
import { createCookieSigner } from "../tracking/cookies";
import { readBuildData } from "../../src/lib/config/build-data";
import { generateSecrets, localPaths } from "../../scripts/create-secrets";

export const localNames = {
  intakeBucket: "district-survey-local-intake",
  usedRecordsBucket: "district-survey-local-used-records",
  archiveBucket: "district-survey-local-archive",
  resultsBucket: "district-survey-local-results",
  completionQueue: "district-survey-local-completion",
};

export const localKeyPairId = "KLOCALEXAMPLE";

/** Creates .local/local.secrets.json on first use, so the local stack needs no set-up step. */
export function ensureLocalSecrets(): string {
  const { secrets: path } = localPaths("local");
  if (!existsSync(path)) {
    mkdirSync(".local", { recursive: true });
    writeFileSync(path, `${JSON.stringify(generateSecrets("local").secrets, null, 2)}\n`, { mode: 0o600 });
  }
  return path;
}

async function setUpMoto(options: { endpoint: string; region: string; forcePathStyle: boolean; credentials: { accessKeyId: string; secretAccessKey: string } }) {
  const s3 = new S3Client(options);
  for (const bucket of [localNames.intakeBucket, localNames.usedRecordsBucket, localNames.archiveBucket, localNames.resultsBucket]) {
    await s3.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: "eu-west-1" } })).catch(() => undefined);
  }

  const sqs = new SQSClient(options);
  await sqs.send(new CreateQueueCommand({ QueueName: `${localNames.completionQueue}-dlq` }));
  await sqs.send(new CreateQueueCommand({ QueueName: localNames.completionQueue }));
  const { QueueUrl } = await sqs.send(new GetQueueUrlCommand({ QueueName: localNames.completionQueue }));

  const ssm = new SSMClient(options);
  for (const control of ["open", "tracked", "survey", "resultsCookies"] as (keyof Controls)[]) {
    await ssm.send(new PutParameterCommand({ Name: controlParameterName("local", control), Value: "true", Type: "String", Overwrite: true }));
  }

  return { s3, sqs, ssm, queueUrl: QueueUrl! };
}

export type LocalStack = Awaited<ReturnType<typeof createLocalLambdas>>;

export async function createLocalLambdas(resultsDomain: string) {
  const buildData = readBuildData();
  const settings = { buildId: "local", surveyId: buildData.surveyId, opensAt: process.env.LOCAL_OPENS_AT ?? buildData.settings.opensAt, closesAt: process.env.LOCAL_CLOSES_AT ?? buildData.settings.closesAt };
  const secretsPath = ensureLocalSecrets();
  const secrets = createFileSecretSource(secretsPath);
  const originValue = parseOriginValues(await secrets("origin-header"))[0]!;
  const now = () => (process.env.LOCAL_NOW ? new Date(process.env.LOCAL_NOW) : new Date());

  let store: RecordStore;
  let controls = fixedControls();
  let metrics: MetricSink = async () => undefined;
  let sendCompletion: (message: CompletionMessage) => Promise<void>;
  const messages: CompletionMessage[] = [];

  if (process.env.LOCAL_STORE === "memory") {
    store = createMemoryRecordStore();
    sendCompletion = async (message) => void messages.push(message);
  } else {
    const options = { endpoint: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566", region: "eu-west-1", forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } };
    const moto = await setUpMoto(options);
    store = createS3RecordStore(moto.s3);
    controls = createSsmControls(moto.ssm, "local");
    metrics = createCloudWatchMetrics(new CloudWatchClient(options), "local");
    sendCompletion = async (message) => {
      messages.push(message);
      await moto.sqs.send(new SendMessageCommand({ QueueUrl: moto.queueUrl, MessageBody: JSON.stringify(message) }));
    };
  }

  const response = createResponseLambda(buildData.compiled, settings, secrets, { store, intakeBucket: localNames.intakeBucket, usedRecordsBucket: localNames.usedRecordsBucket, controls, metrics, now }, undefined, process.env.TURNSTILE_VERIFY_URL);
  const tracking = createTrackingLambda(settings, secrets, {
    store,
    usedRecordsBucket: localNames.usedRecordsBucket,
    controls,
    sendCompletion,
    signCookies: createCookieSigner(resultsDomain, localKeyPairId, () => secrets("cloudfront-cookie-private-key")),
    metrics,
    now,
  });

  return { response, tracking, originValue, secrets, store, messages, buildData };
}
