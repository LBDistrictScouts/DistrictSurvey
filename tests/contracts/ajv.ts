import { readdirSync, readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { parse } from "yaml";

export const root = new URL("../../", import.meta.url);
export const schemaBase = "https://github.com/LBDistrictScouts/DistrictSurvey/contracts/schemas/";
const engineSchemas = new URL("node_modules/@lbdistrictscouts/survey-engine/schemas/", root);

export function readJson(path: string) {
  return JSON.parse(readFileSync(new URL(path, root), "utf8"));
}

/** Ajv with every contract schema and the survey engine's schemas registered by their $id. */
export function contractAjv() {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const name of readdirSync(new URL("contracts/schemas/", root))) ajv.addSchema(readJson(`contracts/schemas/${name}`));
  for (const name of readdirSync(engineSchemas)) ajv.addSchema(JSON.parse(readFileSync(new URL(name, engineSchemas), "utf8")));
  return ajv;
}

export function validator(ajv: ReturnType<typeof contractAjv>, ref: string) {
  const validate = ajv.getSchema(ref.startsWith("https://") ? ref : `${schemaBase}${ref}`);
  if (!validate) throw new Error(`No schema ${ref}`);
  return (value: unknown) => {
    const valid = validate(value) as boolean;
    return { valid, errors: JSON.stringify(validate.errors) };
  };
}

/**
 * Loads an OpenAPI file with its relative $refs rewritten to the registered schema IDs, so Ajv can
 * compile any schema inside it.
 */
export function openApi(name: string) {
  const document = parse(readFileSync(new URL(`contracts/openapi/${name}`, root), "utf8"));
  const engineBase = "https://github.com/LBDistrictScouts/DistrictWorkflow/packages/survey-engine/schemas/";
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
      if (key !== "$ref" || typeof entry !== "string") return [key, rewrite(entry)];
      if (entry.startsWith("../schemas/")) return [key, entry.replace("../schemas/", schemaBase)];
      if (entry.startsWith("../../node_modules/@lbdistrictscouts/survey-engine/schemas/")) return [key, entry.replace("../../node_modules/@lbdistrictscouts/survey-engine/schemas/", engineBase)];
      return [key, entry.replace("#/components/", `${name}#/components/`)];
    }));
  };
  // OpenAPI documents are walked freely in the contract tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rewrite(document) as Record<string, any>;
}
