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

run "g20_district_values_come_from_inputs" {
  command = plan

  assert {
    condition     = aws_cloudfront_distribution.survey.aliases == toset(["survey-test.example.org"]) && aws_cloudfront_distribution.results.aliases == toset(["results-test.example.org"])
    error_message = "Domains come from inputs, not from the module."
  }

  assert {
    condition     = aws_lambda_function.this["tracking"].environment[0].variables.RESULTS_DOMAIN == "results-test.example.org"
    error_message = "The results domain reaches the tracking Lambda from an input."
  }
}

run "environment_must_be_test_or_prod" {
  command = plan

  variables {
    environment = "staging"
  }

  expect_failures = [var.environment]
}

run "certificates_must_be_in_us_east_1" {
  command = plan

  variables {
    survey_certificate_arn = "arn:aws:acm:eu-west-1:123456789012:certificate/00000000-0000-0000-0000-000000000001"
  }

  expect_failures = [var.survey_certificate_arn]
}

run "alert_topics_must_be_in_their_regions" {
  command = plan

  variables {
    alert_topic_arn         = "arn:aws:sns:us-east-1:123456789012:digital-team"
    alert_topic_arn_us_east = "arn:aws:sns:eu-west-1:123456789012:digital-team"
  }

  expect_failures = [var.alert_topic_arn, var.alert_topic_arn_us_east]
}

run "deploy_refs_are_limited" {
  command = plan

  variables {
    allowed_deploy_refs = { survey = "ref:refs/heads/feature", statistics = "ref:refs/heads/main" }
  }

  expect_failures = [var.allowed_deploy_refs]
}

run "deploy_refs_name_both_repositories" {
  command = plan

  variables {
    allowed_deploy_refs = { survey = "ref:refs/heads/main" }
  }

  expect_failures = [var.allowed_deploy_refs]
}

run "domains_must_be_domains" {
  command = plan

  variables {
    survey_domain = "https://survey.example.org"
  }

  expect_failures = [var.survey_domain]
}

run "limits_must_be_sensible" {
  command = plan

  variables {
    limits = { rate = 10, burst = 5, waf_requests_per_5_minutes = 100 }
  }

  expect_failures = [var.limits]
}

run "public_key_must_be_pem" {
  command = plan

  variables {
    cloudfront_public_key_pem = "not a key"
  }

  expect_failures = [var.cloudfront_public_key_pem]
}

run "staff_edge_function_must_be_a_version" {
  command = plan

  variables {
    staff_edge_function_arn = "arn:aws:lambda:eu-west-1:123456789012:function:members-edge"
  }

  expect_failures = [var.staff_edge_function_arn]
}

run "repositories_are_owner_and_name" {
  command = plan

  variables {
    github_repository = "DistrictSurvey"
  }

  expect_failures = [var.github_repository]
}

run "runtime_and_origin_header_choices" {
  command = plan

  variables {
    lambda_runtime       = "nodejs18.x"
    origin_header_active = "c"
  }

  expect_failures = [var.lambda_runtime, var.origin_header_active]
}
