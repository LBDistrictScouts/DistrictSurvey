import { getSignedCookies } from "@aws-sdk/cloudfront-signer";
import type { CookieSigner } from "./context";

/**
 * CloudFront signed cookies for one survey's results data. A custom policy limits them to
 * /results-data/{surveyId}/ and to the given expiry.
 */
export function createCookieSigner(resultsDomain: string, keyPairId: string, privateKey: () => Promise<string>): CookieSigner {
  return async (surveyId, expiresAt) => {
    const policy = JSON.stringify({
      Statement: [{ Resource: `https://${resultsDomain}/results-data/${surveyId}/*`, Condition: { DateLessThan: { "AWS:EpochTime": Math.floor(expiresAt.getTime() / 1000) } } }],
    });
    const cookies = getSignedCookies({ policy, keyPairId, privateKey: await privateKey() });
    const attributes = `Path=/results-data/; Expires=${expiresAt.toUTCString()}; Secure; HttpOnly; SameSite=Lax`;

    return [
      `CloudFront-Policy=${cookies["CloudFront-Policy"]}; ${attributes}`,
      `CloudFront-Signature=${cookies["CloudFront-Signature"]}; ${attributes}`,
      `CloudFront-Key-Pair-Id=${cookies["CloudFront-Key-Pair-Id"]}; ${attributes}`,
    ];
  };
}
