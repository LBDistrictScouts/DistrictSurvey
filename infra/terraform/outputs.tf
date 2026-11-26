output "survey_site_bucket" {
  description = "Bucket the deploy workflow uploads the survey site to."
  value       = aws_s3_bucket.this["survey_site"].id
}

output "results_site_bucket" {
  description = "Bucket DistrictStatistics CI uploads data-viz to."
  value       = aws_s3_bucket.this["results_site"].id
}

output "results_bucket" {
  description = "Bucket DistrictStatistics writes results-data/ to."
  value       = aws_s3_bucket.this["results"].id
}

output "intake_bucket" {
  description = "Bucket the response Lambda writes answer and comment files to."
  value       = aws_s3_bucket.this["intake"].id
}

output "used_records_bucket" {
  description = "Bucket holding one-way used-link and receipt records."
  value       = aws_s3_bucket.this["used_records"].id
}

output "archive_bucket" {
  description = "Bucket DistrictWorkflow writes verified batch archives to."
  value       = aws_s3_bucket.this["archive"].id
}

output "survey_distribution_id" {
  description = "Survey CloudFront distribution, for invalidations."
  value       = aws_cloudfront_distribution.survey.id
}

output "results_distribution_id" {
  description = "Results CloudFront distribution, for invalidations."
  value       = aws_cloudfront_distribution.results.id
}

output "api_url" {
  description = "API Gateway endpoint. Only CloudFront can call it successfully."
  value       = aws_apigatewayv2_api.survey.api_endpoint
}

output "completion_queue_url" {
  description = "Queue DistrictWorkflow reads completion messages from."
  value       = aws_sqs_queue.completion.url
}

output "email_feedback_queue_url" {
  description = "Queue DistrictWorkflow reads SES survey email events from."
  value       = aws_sqs_queue.email_feedback.url
}

output "ses_configuration_set" {
  description = "SES configuration set for every survey email."
  value       = aws_sesv2_configuration_set.survey.configuration_set_name
}

output "control_parameter_names" {
  description = "SSM control parameters by control."
  value       = { for key, parameter in aws_ssm_parameter.control : key => parameter.name }
}

output "secret_arns" {
  description = "Secret containers by name. yarn secrets:create --store fills them."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "turnstile_site_key" {
  description = "Public Turnstile site key for the survey site build."
  value       = cloudflare_turnstile_widget.survey.sitekey
}

output "cloudfront_key_pair_id" {
  description = "ID of the CloudFront public key that verifies results cookies."
  value       = aws_cloudfront_public_key.cookies.id
}

output "deploy_role_arn" {
  description = "Role the DistrictSurvey deploy workflow assumes."
  value       = aws_iam_role.deploy["survey"].arn
}

output "results_deploy_role_arn" {
  description = "Role DistrictStatistics CI assumes to deploy data-viz."
  value       = aws_iam_role.deploy["statistics"].arn
}

output "district_workflow_policy_arn" {
  description = "Policy for DistrictWorkflow's identity, attached by the hosting plan."
  value       = aws_iam_policy.district_workflow.arn
}

output "district_statistics_policy_arn" {
  description = "Policy for DistrictStatistics' identity, attached by the hosting plan."
  value       = aws_iam_policy.district_statistics.arn
}
