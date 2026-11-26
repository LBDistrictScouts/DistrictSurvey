// yarn tsx scripts/read-test-queue.ts --env <local|test> [--keep] [--wait <seconds>]
//
// A Phase 3 stand-in for DistrictWorkflow's completion intake: prints each completion message and
// deletes it unless --keep is given.
import { DeleteMessageCommand, ReceiveMessageCommand, type SQSClient } from "@aws-sdk/client-sqs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { CompletionMessage } from "../functions/tracking/context";
import { clients, resources, testEnvironment } from "./test-environment";

export async function readQueue(sqs: SQSClient, queueUrl: string, keep: boolean, waitSeconds = 1): Promise<CompletionMessage[]> {
  const messages: CompletionMessage[] = [];
  for (;;) {
    const result = await sqs.send(new ReceiveMessageCommand({ QueueUrl: queueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: waitSeconds, VisibilityTimeout: keep ? 0 : 30 }));
    if (!result.Messages?.length) return messages;
    for (const message of result.Messages) {
      messages.push(JSON.parse(message.Body ?? "{}"));
      if (!keep) await sqs.send(new DeleteMessageCommand({ QueueUrl: queueUrl, ReceiptHandle: message.ReceiptHandle }));
    }
    if (keep) return messages;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const { values } = parseArgs({ options: { env: { type: "string" }, keep: { type: "boolean" }, wait: { type: "string", default: "1" } } });
  const environment = testEnvironment(values.env);
  readQueue(clients(environment).sqs, resources(environment).completionQueueUrl, values.keep ?? false, Number(values.wait)).then((messages) => {
    for (const message of messages) console.log(JSON.stringify(message));
    console.log(`${messages.length} completion ${messages.length === 1 ? "message" : "messages"}`);
  });
}
