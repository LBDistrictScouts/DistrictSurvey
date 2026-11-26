# Survey Terraform module

Creates everything one survey environment needs in AWS and Cloudflare: the survey and results CloudFront
distributions, six private buckets, the API and both Lambdas, the completion and email feedback queues,
the Turnstile widget, the SES configuration set, the web ACL, the control parameters, empty secret
containers, the IAM roles and policies, and every alarm.

DistrictInfrastructure imports it twice, once for test and once for production:

```hcl
module "survey_test" {
  source    = "git::https://github.com/LBDistrictScouts/DistrictSurvey.git//infra/terraform?ref=v1.0.0"
  providers = { aws = aws, aws.us_east = aws.us_east, cloudflare = cloudflare }

  environment               = "test"
  survey_domain             = "survey-test.example.org"
  results_domain            = "results-test.example.org"
  allowed_deploy_refs       = { survey = "ref:refs/heads/main", statistics = "ref:refs/heads/main" }
  cloudfront_public_key_pem = file("survey-test.public-keys.pem")
  # ...the other inputs below
}
```

Production uses `environment = "prod"` and `allowed_deploy_refs = { survey = "environment:production", statistics = "environment:production" }`, so only jobs in the protected `production` GitHub environment can deploy.

## Inputs

| Input | Type | Notes |
| --- | --- | --- |
| `environment` | `string` | `test` or `prod` |
| `survey_domain`, `results_domain` | `string` | Lower-case domain names |
| `route53_zone_id` | `string` | Zone holding both domains |
| `survey_certificate_arn`, `results_certificate_arn` | `string` | ACM certificates in us-east-1 |
| `cloudflare_account_id` | `string` | Owner of the Turnstile widget |
| `alert_topic_arn`, `alert_topic_arn_us_east` | `string` | Digital team topics in eu-west-1 and us-east-1 |
| `github_oidc_provider_arn`, `github_repository`, `statistics_repository` | `string` | Deploy role trust |
| `allowed_deploy_refs` | `map(string)` | Keys `survey` and `statistics`. Each value is the OIDC subject suffix that may deploy |
| `cloudfront_public_key_pem` | `string` | From `yarn secrets:create --generate` |
| `staff_edge_function_arn` | `string`, optional | Numbered Lambda@Edge version for staff sign-in on `/staff-data/*`. Null closes the path |
| `firewall_enabled` | `bool` | Turns on the web ACL for the survey period |
| `limits` | `object({ rate, burst, waf_requests_per_5_minutes })` | Set from audience sizes, confirmed by the load test |
| `abuse_alarm_threshold` | `number` | Turnstile rejections in 5 minutes that raise the abuse alarm |
| `origin_header_active` | `string` | `a` or `b`. See "Rotating the origin header" |
| `lambda_runtime` | `string` | `nodejs24.x`, or `nodejs22.x` |

`staff_edge_function_arn` replaces the design's `staff_cognito` input. The members-area edge function in
DistrictInfrastructure serves `/members/*` paths and one Cognito group, so it needs a path prefix and a
group list before the results site can use it. DistrictInfrastructure builds that version and passes it in.

## Outputs

`survey_site_bucket`, `results_site_bucket`, `results_bucket`, `intake_bucket`, `used_records_bucket`,
`archive_bucket`, `survey_distribution_id`, `results_distribution_id`, `api_url`, `completion_queue_url`,
`email_feedback_queue_url`, `ses_configuration_set`, `control_parameter_names`, `secret_arns`,
`turnstile_site_key`, `cloudfront_key_pair_id`, `deploy_role_arn`, `results_deploy_role_arn`,
`district_workflow_policy_arn` and `district_statistics_policy_arn`.

## Setting up an environment

1. `yarn secrets:create --env test --generate` writes every key locally and the CloudFront public key to `.local/test.public-keys.json`.
2. Apply DistrictInfrastructure with that public key. This creates the empty secret containers.
3. `yarn secrets:create --env test --store` fills the containers and 1Password, then deletes the local copies.
4. Deploy the site and Lambdas with `deploy.yml`, then run the smoke test.

Terraform writes two secrets itself: the Turnstile secret, which Cloudflare issues, and the origin header
values, which are generated in state so CloudFront and the Lambdas always agree.

## Rotating the origin header

Both values in the `origin-header` secret are accepted, and CloudFront sends the active one.

1. Replace the inactive value: `terraform apply -replace='module.survey_test.random_password.origin_header["b"]'`.
2. Wait 5 minutes for the Lambdas' secret cache.
3. Set `origin_header_active = "b"` and apply.

## Checks

```bash
terraform init -backend=false
terraform fmt -check -recursive
terraform test
(cd tests/root && terraform init -backend=false && terraform validate)
tflint --init && tflint
trivy config .
```

`terraform test` uses mock providers, so it creates nothing. Every resource that controls access,
encryption, logging, routing or alarms has an assertion. Run blocks named `g18_...`, `g20_...` and so on
count towards the goal traceability check.
