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

run "g10_results_data_needs_signed_cookies" {
  command = apply

  assert {
    condition     = one([for behaviour in aws_cloudfront_distribution.results.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/results-data/*"]).trusted_key_groups == tolist([aws_cloudfront_key_group.cookies.id])
    error_message = "Volunteer results must be served only with CloudFront signed cookies."
  }

  assert {
    condition     = one([for behaviour in aws_cloudfront_distribution.results.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/results-data/*"]).target_origin_id == "results"
    error_message = "/results-data/* must come from the results bucket."
  }

  assert {
    condition     = one([for behaviour in aws_cloudfront_distribution.results.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/api/results-access"]).target_origin_id == "api"
    error_message = "/api/results-access must reach the tracking Lambda through API Gateway."
  }

  assert {
    condition     = aws_cloudfront_public_key.cookies.encoded_key == var.cloudfront_public_key_pem
    error_message = "The cookie key group must use the public key from secrets:create."
  }
}

run "g10_staff_data_is_closed_without_the_edge_function" {
  command = apply

  assert {
    condition     = one(one([for behaviour in aws_cloudfront_distribution.results.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/staff-data/*"]).function_association).function_arn == aws_cloudfront_function.deny.arn
    error_message = "/staff-data/* must refuse every request until the staff sign-in edge function is attached."
  }
}

run "staff_data_uses_the_edge_function" {
  command = apply

  variables {
    staff_edge_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:members-edge:7"
  }

  assert {
    condition     = one(one([for behaviour in aws_cloudfront_distribution.results.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/staff-data/*"]).lambda_function_association).lambda_arn == var.staff_edge_function_arn
    error_message = "/staff-data/* must check staff sign-in at the edge."
  }
}

run "survey_distribution_routes_and_headers" {
  command = apply

  assert {
    condition     = length(aws_cloudfront_distribution.survey.logging_config) == 0 && length(aws_cloudfront_distribution.results.logging_config) == 0
    error_message = "CloudFront access logs must be off, so no record shows who visited."
  }

  assert {
    condition     = one([for behaviour in aws_cloudfront_distribution.survey.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/api/*"]).cache_policy_id == "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    error_message = "API responses must never be cached."
  }

  assert {
    condition     = alltrue([for origin in aws_cloudfront_distribution.survey.origin : origin.origin_id != "api" || one(origin.custom_header).name == "x-origin-verify"])
    error_message = "CloudFront must add the secret origin header to API requests."
  }

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.survey["site"].security_headers_config[0].content_security_policy[0].content_security_policy, "script-src 'self';")
    error_message = "Pages other than /survey allow scripts from the site only."
  }

  assert {
    condition     = strcontains(aws_cloudfront_response_headers_policy.survey["turnstile"].security_headers_config[0].content_security_policy[0].content_security_policy, "https://challenges.cloudflare.com")
    error_message = "/survey allows Turnstile."
  }

  assert {
    condition     = one([for behaviour in aws_cloudfront_distribution.survey.ordered_cache_behavior : behaviour if behaviour.path_pattern == "/survey*"]).response_headers_policy_id == aws_cloudfront_response_headers_policy.survey["turnstile"].id
    error_message = "Only the /survey behaviour uses the Turnstile policy."
  }

  assert {
    condition     = aws_cloudfront_response_headers_policy.survey["site"].security_headers_config[0].strict_transport_security[0].access_control_max_age_sec == 63072000
    error_message = "Strict-Transport-Security must last two years."
  }

  assert {
    condition     = alltrue([for response in aws_cloudfront_distribution.survey.custom_error_response : response.error_code == 404])
    error_message = "Only 404 is replaced, so API error bodies reach the browser."
  }

  assert {
    condition     = aws_cloudfront_distribution.survey.web_acl_id == aws_wafv2_web_acl.survey[0].arn
    error_message = "The survey distribution uses the web ACL while the firewall is on."
  }
}

run "web_acl_rate_rule" {
  command = apply

  assert {
    condition     = one(one(aws_wafv2_web_acl.survey[0].rule).statement[0].rate_based_statement).limit == 100
    error_message = "The open-link rate rule uses limits.waf_requests_per_5_minutes."
  }

  assert {
    condition     = one(aws_wafv2_web_acl.survey[0].rule).statement[0].rate_based_statement[0].scope_down_statement[0].byte_match_statement[0].search_string == "/api/v1/responses/open"
    error_message = "The rate rule applies to the open-link response route only."
  }

  assert {
    condition     = !aws_wafv2_web_acl.survey[0].visibility_config[0].sampled_requests_enabled
    error_message = "Sampled requests would keep IP addresses, so they are off."
  }
}

run "firewall_off" {
  command = plan

  variables {
    firewall_enabled = false
  }

  assert {
    condition     = length(aws_wafv2_web_acl.survey) == 0 && aws_cloudfront_distribution.survey.web_acl_id == null
    error_message = "The web ACL exists only for the survey period."
  }
}
