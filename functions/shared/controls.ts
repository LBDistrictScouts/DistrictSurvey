import { GetParametersCommand, type SSMClient } from "@aws-sdk/client-ssm";

export type Controls = {
  open: boolean;
  tracked: boolean;
  survey: boolean;
  resultsCookies: boolean;
};

export type ControlSource = () => Promise<Controls>;

const names = { open: "open", tracked: "tracked", survey: "survey", resultsCookies: "results-cookies" } as const;

// Changes on the DistrictWorkflow controls page must apply within 1 minute.
export const controlsCacheMilliseconds = 30_000;

export function controlParameterName(environment: string, control: keyof Controls): string {
  return `/district-survey/${environment}/controls/${names[control]}`;
}

/**
 * Reads the four SSM switches. A parameter that is missing or not exactly "true" counts as off, so a
 * misconfigured environment refuses submissions rather than accepting them.
 */
export function createSsmControls(client: SSMClient, environment: string, now: () => number = Date.now): ControlSource {
  let cached: { at: number; value: Controls } | undefined;

  return async () => {
    if (cached && now() - cached.at < controlsCacheMilliseconds) return cached.value;

    const keys = Object.keys(names) as (keyof Controls)[];
    const result = await client.send(new GetParametersCommand({ Names: keys.map((key) => controlParameterName(environment, key)) }));
    const values = new Map((result.Parameters ?? []).map((parameter) => [parameter.Name, parameter.Value]));
    const value = Object.fromEntries(keys.map((key) => [key, values.get(controlParameterName(environment, key)) === "true"])) as Controls;

    cached = { at: now(), value };
    return value;
  };
}

export function fixedControls(value: Partial<Controls> = {}): ControlSource {
  return async () => ({ open: true, tracked: true, survey: true, resultsCookies: true, ...value });
}
