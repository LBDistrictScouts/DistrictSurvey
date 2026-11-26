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

run "api_routes_reach_the_right_lambda" {
  command = apply

  assert {
    condition     = length(aws_apigatewayv2_route.survey) == 8
    error_message = "The API has the eight routes in the survey API contract."
  }

  assert {
    condition = alltrue([for key, route in aws_apigatewayv2_route.survey :
      route.target == "integrations/${aws_apigatewayv2_integration.lambda[startswith(key, "POST /api/v1/responses/") ? "response" : "tracking"].id}"
    ])
    error_message = "Response routes reach the response Lambda and every other route the tracking Lambda."
  }

  assert {
    condition = alltrue([for setting in aws_apigatewayv2_stage.default.route_settings :
      setting.throttling_rate_limit == 10 && setting.throttling_burst_limit == 20
    ]) && length(aws_apigatewayv2_stage.default.route_settings) == 2
    error_message = "Each response route starts at rate 10 and burst 20."
  }

  assert {
    condition     = !strcontains(aws_apigatewayv2_stage.default.access_log_settings[0].format, "sourceIp") && !strcontains(aws_apigatewayv2_stage.default.access_log_settings[0].format, "userAgent")
    error_message = "API Gateway logs omit client IP addresses and user agents."
  }

  assert {
    condition     = aws_cloudwatch_log_group.api.retention_in_days == 14 && alltrue([for group in aws_cloudwatch_log_group.lambda : group.retention_in_days == 14])
    error_message = "Lambda and API Gateway logs are kept for 14 days."
  }
}

run "lambda_settings" {
  command = apply

  assert {
    condition     = alltrue([for function in aws_lambda_function.this : function.memory_size == 512 && function.timeout == 8 && function.runtime == "nodejs24.x"])
    error_message = "Both Lambdas use 512 MB, an 8-second timeout and Node.js 24."
  }

  assert {
    condition     = !contains(keys(aws_lambda_function.this["response"].environment[0].variables), "COMPLETION_QUEUE_URL")
    error_message = "The response Lambda is not told where the completion queue is."
  }

  assert {
    condition     = !contains(keys(aws_lambda_function.this["tracking"].environment[0].variables), "INTAKE_BUCKET")
    error_message = "The tracking Lambda is not told where answers are stored."
  }
}
