import { PutMetricDataCommand, type CloudWatchClient } from "@aws-sdk/client-cloudwatch";

/** Metric names published by the Lambdas, from contracts/schemas/metrics.v1.json. */
export type LambdaMetric = "CompletionSendFailed" | "TurnstileRejected";

export type MetricSink = (name: LambdaMetric) => Promise<void>;

export function metricNamespace(environment: string): string {
  return `DistrictSurvey/${environment}`;
}

/**
 * Publishes a count of 1 with no dimensions, so a metric never identifies a respondent. A failed
 * publish is ignored: alarms on Lambda errors cover a broken metrics path.
 */
export function createCloudWatchMetrics(client: CloudWatchClient, environment: string): MetricSink {
  return async (name) => {
    try {
      await client.send(new PutMetricDataCommand({ Namespace: metricNamespace(environment), MetricData: [{ MetricName: name, Value: 1, Unit: "Count" }] }));
    } catch {
      // Ignored on purpose. See above.
    }
  };
}
