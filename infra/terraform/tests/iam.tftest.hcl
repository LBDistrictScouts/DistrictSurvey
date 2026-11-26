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

# Distinct ARNs, so tests can tell the buckets, secrets and queues apart.
override_resource {
  target = aws_s3_bucket.this["intake"]
  values = { arn = "arn:aws:s3:::intake-mock", id = "intake-mock", bucket_regional_domain_name = "intake-mock.s3.eu-west-1.amazonaws.com" }
}

override_resource {
  target = aws_s3_bucket.this["used_records"]
  values = { arn = "arn:aws:s3:::used-records-mock", id = "used-records-mock", bucket_regional_domain_name = "used-records-mock.s3.eu-west-1.amazonaws.com" }
}

override_resource {
  target = aws_s3_bucket.this["archive"]
  values = { arn = "arn:aws:s3:::archive-mock", id = "archive-mock", bucket_regional_domain_name = "archive-mock.s3.eu-west-1.amazonaws.com" }
}

override_resource {
  target = aws_s3_bucket.this["results"]
  values = { arn = "arn:aws:s3:::results-mock", id = "results-mock", bucket_regional_domain_name = "results-mock.s3.eu-west-1.amazonaws.com" }
}

override_resource {
  target = aws_secretsmanager_secret.this["file-name-key"]
  values = { arn = "arn:aws:secretsmanager:eu-west-1:123456789012:secret:file-name-key" }
}

override_resource {
  target = aws_sqs_queue.completion
  values = { arn = "arn:aws:sqs:eu-west-1:123456789012:completion", url = "https://sqs.eu-west-1.amazonaws.com/123456789012/completion" }
}

run "response_lambda_cannot_reach_tracking_resources" {
  command = apply

  assert {
    condition     = !contains(flatten([for statement in data.aws_iam_policy_document.response.statement : statement.actions]), "sqs:SendMessage")
    error_message = "The response Lambda cannot send completion messages."
  }

  assert {
    condition     = one([for statement in data.aws_iam_policy_document.response.statement : statement if statement.sid == "DeleteOwnAnswerFile"]).resources == toset(["${aws_s3_bucket.this["intake"].arn}/intake/answers/*"])
    error_message = "The response Lambda can delete only intake/answers/*."
  }

  assert {
    condition     = toset(one([for statement in data.aws_iam_policy_document.response.statement : statement if statement.sid == "Secrets"]).resources) == toset([for name in ["file-name-key", "tracked-pass-public-key", "receipt-private-key", "turnstile-secret", "origin-header"] : aws_secretsmanager_secret.this[name].arn])
    error_message = "The response Lambda reads only its own secrets."
  }

  assert {
    condition     = !anytrue([for statement in data.aws_iam_policy_document.response.statement : anytrue([for resource in statement.resources : strcontains(resource, "receipts/")])])
    error_message = "The response Lambda cannot read or write used receipt records."
  }
}

run "tracking_lambda_cannot_reach_answers" {
  command = apply

  assert {
    condition     = !anytrue([for statement in data.aws_iam_policy_document.tracking.statement : anytrue([for resource in statement.resources : strcontains(resource, aws_s3_bucket.this["intake"].arn)])])
    error_message = "The tracking Lambda has no access to the intake bucket."
  }

  assert {
    condition     = one([for statement in data.aws_iam_policy_document.tracking.statement : statement if statement.sid == "CompletionMessages"]).resources == toset([aws_sqs_queue.completion.arn])
    error_message = "The tracking Lambda sends only to the completion queue."
  }

  assert {
    condition     = !contains(one([for statement in data.aws_iam_policy_document.tracking.statement : statement if statement.sid == "Secrets"]).resources, aws_secretsmanager_secret.this["file-name-key"].arn)
    error_message = "The tracking Lambda cannot read the file name key."
  }
}

run "metrics_are_limited_to_the_namespace" {
  command = apply

  assert {
    condition = alltrue(flatten([for document in [data.aws_iam_policy_document.response, data.aws_iam_policy_document.tracking, data.aws_iam_policy_document.district_workflow] : [
      for statement in document.statement : [for condition in statement.condition : length(condition.values) == 1 && contains(condition.values, "DistrictSurvey/test")] if statement.sid == "Metrics"
    ]]))
    error_message = "PutMetricData is allowed only in DistrictSurvey/{environment}."
  }
}

run "application_policies" {
  command = apply

  assert {
    condition     = !anytrue([for statement in data.aws_iam_policy_document.district_workflow.statement : contains(statement.actions, "secretsmanager:GetSecretValue")])
    error_message = "DistrictWorkflow reads its keys from 1Password, never from the Lambdas' secrets."
  }

  assert {
    condition     = toset(one([for statement in data.aws_iam_policy_document.district_workflow.statement : statement if statement.sid == "ImportAlarms"]).resources) == toset([for alarm in aws_cloudwatch_metric_alarm.import : alarm.arn])
    error_message = "DistrictWorkflow can switch only the import alarms on and off."
  }

  assert {
    condition     = one([for statement in data.aws_iam_policy_document.district_statistics.statement : statement if statement.sid == "PublishResults"]).resources == toset(["${aws_s3_bucket.this["results"].arn}/results-data/*"])
    error_message = "DistrictStatistics writes only results-data/*."
  }

  assert {
    condition     = !anytrue([for document in [data.aws_iam_policy_document.district_workflow, data.aws_iam_policy_document.district_statistics] : anytrue([for statement in document.statement : anytrue([for action in statement.actions : startswith(action, "wafv2:")])])])
    error_message = "No application identity can change the web ACL."
  }
}

run "g27_deploy_roles_trust_one_subject" {
  command = apply

  assert {
    condition     = one([for condition in one(data.aws_iam_policy_document.deploy_trust["survey"].statement).condition : condition if condition.variable == "token.actions.githubusercontent.com:sub"]).values == tolist(["repo:ExampleOrg/DistrictSurvey:ref:refs/heads/main"])
    error_message = "The test deploy role trusts only main in DistrictSurvey."
  }

  assert {
    condition     = one([for condition in one(data.aws_iam_policy_document.deploy_trust["statistics"].statement).condition : condition if condition.variable == "token.actions.githubusercontent.com:sub"]).values == tolist(["repo:ExampleOrg/DistrictStatistics:ref:refs/heads/main"])
    error_message = "The results deploy role trusts only DistrictStatistics."
  }

  assert {
    condition     = toset(one([for statement in data.aws_iam_policy_document.survey_deploy.statement : statement if statement.sid == "LambdaCode"]).actions) == toset(["lambda:UpdateFunctionCode", "lambda:GetFunctionConfiguration"])
    error_message = "The deploy role can update Lambda code and nothing else about the functions."
  }
}

run "g27_production_deploys_need_the_production_environment" {
  command = apply

  variables {
    environment         = "prod"
    allowed_deploy_refs = { survey = "environment:production", statistics = "environment:production" }
  }

  assert {
    condition     = one([for condition in one(data.aws_iam_policy_document.deploy_trust["survey"].statement).condition : condition if condition.variable == "token.actions.githubusercontent.com:sub"]).values == tolist(["repo:ExampleOrg/DistrictSurvey:environment:production"])
    error_message = "The production deploy role trusts only jobs in the production environment."
  }
}
