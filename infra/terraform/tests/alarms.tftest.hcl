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

run "g18_every_alarm_exists_and_notifies" {
  command = apply

  assert {
    condition     = length(aws_cloudwatch_metric_alarm.lambda) == 4 && length(aws_cloudwatch_metric_alarm.custom) == 6 && length(aws_cloudwatch_metric_alarm.import) == 2 && length(aws_cloudwatch_metric_alarm.waf_blocked) == 1
    error_message = "Every alarm in the design exists: API errors, Lambda errors and throttles, completion sends, dead letters, imports, archives, comments, releases, abuse and bounces."
  }

  assert {
    condition = alltrue(concat(
      [for alarm in aws_cloudwatch_metric_alarm.lambda : alarm.alarm_actions == toset([var.alert_topic_arn])],
      [for alarm in aws_cloudwatch_metric_alarm.custom : alarm.alarm_actions == toset([var.alert_topic_arn])],
      [for alarm in aws_cloudwatch_metric_alarm.import : alarm.alarm_actions == toset([var.alert_topic_arn])],
      [aws_cloudwatch_metric_alarm.api_5xx.alarm_actions == toset([var.alert_topic_arn]), aws_cloudwatch_metric_alarm.dead_letters.alarm_actions == toset([var.alert_topic_arn])],
    ))
    error_message = "Every eu-west-1 alarm notifies the digital team topic."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.waf_blocked[0].alarm_actions == toset([var.alert_topic_arn_us_east])
    error_message = "The us-east-1 firewall alarm notifies the us-east-1 topic."
  }
}

run "g18_alarm_thresholds_and_missing_data" {
  command = apply

  assert {
    condition     = aws_cloudwatch_metric_alarm.api_5xx.threshold == 5 && aws_cloudwatch_metric_alarm.api_5xx.period == 300 && aws_cloudwatch_metric_alarm.api_5xx.treat_missing_data == "notBreaching"
    error_message = "API errors alarm at 5 or more in 5 minutes."
  }

  assert {
    condition     = alltrue([for alarm in aws_cloudwatch_metric_alarm.import : alarm.treat_missing_data == "breaching" && !alarm.actions_enabled])
    error_message = "Import alarms treat missing data as a fault and start with actions off."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.import["import-stopped"].evaluation_periods * aws_cloudwatch_metric_alarm.import["import-stopped"].period == 14 * 3600
    error_message = "The import heartbeat alarm fires after 14 hours with no import."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.import["intake-backlog"].threshold == 14 && aws_cloudwatch_metric_alarm.import["intake-backlog"].comparison_operator == "GreaterThanThreshold"
    error_message = "The intake backlog alarm fires above 14 hours."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.custom["completion-send-failed"].namespace == "DistrictSurvey/test" && aws_cloudwatch_metric_alarm.custom["completion-send-failed"].threshold == 1
    error_message = "Custom alarms read the DistrictSurvey/{environment} namespace."
  }

  assert {
    condition     = aws_cloudwatch_metric_alarm.custom["survey-bounce-rate"].threshold > 5 && aws_cloudwatch_metric_alarm.custom["survey-bounce-rate"].threshold < 5.001
    error_message = "The bounce alarm fires above 5% of sends."
  }
}
