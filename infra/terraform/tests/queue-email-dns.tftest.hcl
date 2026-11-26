mock_provider "aws" {
  source = "./tests/mocks/aws"
}

mock_provider "aws" {
  alias  = "us_east"
  source = "./tests/mocks/aws"
}

mock_provider "cloudflare" {
  source = "./tests/mocks/cloudflare"
}

mock_provider "random" {
  mock_resource "random_password" {
    defaults = { result = "mockoriginheadervaluemockoriginheadervalue123456" }
  }
}

mock_provider "archive" {}

variables {
  environment               = "test"
  survey_domain             = "survey-test.example.org"
  results_domain            = "results-test.example.org"
  route53_zone_id           = "Z0000000000000000000"
  survey_certificate_arn    = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000001"
  results_certificate_arn   = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
  cloudflare_account_id     = "0123456789abcdef0123456789abcdef"
  alert_topic_arn           = "arn:aws:sns:eu-west-1:123456789012:digital-team"
  alert_topic_arn_us_east   = "arn:aws:sns:us-east-1:123456789012:digital-team"
  github_oidc_provider_arn  = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  github_repository         = "ExampleOrg/DistrictSurvey"
  statistics_repository     = "ExampleOrg/DistrictStatistics"
  allowed_deploy_refs       = { survey = "ref:refs/heads/main", statistics = "ref:refs/heads/main" }
  cloudfront_public_key_pem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAexample\n-----END PUBLIC KEY-----\n"
  firewall_enabled          = true
}

run "completion_queue" {
  command = apply

  assert {
    condition     = aws_sqs_queue.completion.visibility_timeout_seconds == 60 && aws_sqs_queue.completion.message_retention_seconds == 1209600
    error_message = "The completion queue has a 60-second visibility timeout and keeps messages for 14 days."
  }

  assert {
    condition     = jsondecode(aws_sqs_queue.completion.redrive_policy).maxReceiveCount == 5 && jsondecode(aws_sqs_queue.completion.redrive_policy).deadLetterTargetArn == aws_sqs_queue.completion_dlq.arn
    error_message = "Messages move to the dead-letter queue after 5 failed receives."
  }

  assert {
    condition     = aws_sqs_queue.completion.sqs_managed_sse_enabled && aws_sqs_queue.completion_dlq.sqs_managed_sse_enabled && aws_sqs_queue.email_feedback.sqs_managed_sse_enabled
    error_message = "Queues are encrypted."
  }
}

run "survey_email_records_no_opens_or_clicks" {
  command = apply

  assert {
    condition     = toset(aws_sesv2_configuration_set_event_destination.survey.event_destination[0].matching_event_types) == toset(["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"])
    error_message = "The survey configuration set records send, delivery, bounce and complaint only."
  }

  assert {
    condition     = aws_sesv2_configuration_set_event_destination.survey.event_destination[0].sns_destination[0].topic_arn == aws_sns_topic.email_feedback.arn && aws_sns_topic_subscription.email_feedback.endpoint == aws_sqs_queue.email_feedback.arn
    error_message = "SES events reach the survey feedback queue through the survey topic."
  }
}

run "dns_points_both_domains_at_cloudfront" {
  command = apply

  assert {
    condition     = length(aws_route53_record.alias) == 4
    error_message = "Each domain has A and AAAA alias records."
  }

  assert {
    condition     = aws_route53_record.alias["survey-A"].name == "survey-test.example.org" && aws_route53_record.alias["results-AAAA"].name == "results-test.example.org"
    error_message = "Records use the configured domains."
  }
}

run "turnstile_widget_is_limited_to_the_survey_domain" {
  command = apply

  assert {
    condition     = toset(cloudflare_turnstile_widget.survey.domains) == toset(["survey-test.example.org"])
    error_message = "The Turnstile widget accepts only the survey domain."
  }

  assert {
    condition     = aws_secretsmanager_secret_version.turnstile.secret_string == "0x4AAAAAAAMOCKSECRET"
    error_message = "The Turnstile secret is copied into the response Lambda's secret."
  }
}

run "controls_start_off" {
  command = apply

  assert {
    condition     = alltrue([for parameter in aws_ssm_parameter.control : parameter.value == "false" && parameter.type == "String"]) && length(aws_ssm_parameter.control) == 4
    error_message = "The four controls start off until the survey is opened."
  }

  assert {
    condition     = aws_ssm_parameter.control["results-cookies"].name == "/district-survey/test/controls/results-cookies"
    error_message = "Control names follow the contract."
  }
}

run "secrets" {
  command = apply

  assert {
    condition     = length(aws_secretsmanager_secret.this) == 13
    error_message = "Every secret has its own container."
  }

  assert {
    condition     = jsondecode(aws_secretsmanager_secret_version.origin_header.secret_string) == [random_password.origin_header["a"].result, random_password.origin_header["b"].result]
    error_message = "Both origin header values are accepted, so one can be replaced at a time."
  }
}
