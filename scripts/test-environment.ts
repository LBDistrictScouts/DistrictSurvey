// Shared set-up for the scripts that act on the local or test environment. Prod is refused.
import { S3Client } from "@aws-sdk/client-s3";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SQSClient } from "@aws-sdk/client-sqs";
import { SSMClient } from "@aws-sdk/client-ssm";

export type TestEnvironment = "local" | "test";

export function testEnvironment(value: string | undefined): TestEnvironment {
  if (value === "local" || value === "test") return value;
  throw new Error("Use --env local or --env test. These scripts never act on production.");
}

/**
 * AWS clients for one environment. Local uses DistrictWorkflow's Moto on port 4566 with its dummy
 * credentials; test uses the lbd-survey-test profile from the environment.
 */
export function clients(environment: TestEnvironment) {
  const local = environment === "local";
  const options = local
    ? { endpoint: process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566", region: "eu-west-1", forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } }
    : { region: "eu-west-1" };
  return { s3: new S3Client(options), sqs: new SQSClient(options), ssm: new SSMClient(options), secrets: new SecretsManagerClient(options) };
}

/** Resource names: the local defaults, or the module outputs for test, passed as environment variables. */
export function resources(environment: TestEnvironment) {
  const named = (variable: string, local: string) => {
    const value = process.env[variable] ?? (environment === "local" ? local : undefined);
    if (!value) throw new Error(`Set ${variable} from the survey module's outputs`);
    return value;
  };
  return {
    intakeBucket: named("INTAKE_BUCKET", "district-survey-local-intake"),
    usedRecordsBucket: named("USED_RECORDS_BUCKET", "district-survey-local-used-records"),
    archiveBucket: named("ARCHIVE_BUCKET", "district-survey-local-archive"),
    resultsBucket: named("RESULTS_BUCKET", "district-survey-local-results"),
    completionQueueUrl: named("COMPLETION_QUEUE_URL", "http://localhost:4566/000000000000/district-survey-local-completion"),
    deadLetterQueueUrl: named("COMPLETION_DLQ_URL", "http://localhost:4566/000000000000/district-survey-local-completion-dlq"),
  };
}
