# Each identity has only the actions in "Permissions" in the design, with two additions:
#  - The response Lambda reads links/* to tell a retry from a second response.
#  - The tracking Lambda may list the used-records bucket. Without it, S3 answers a missing record with
#    403 rather than 404, and a missing record cannot be told apart from a refused read.
locals {
  bucket_arn             = { for key, bucket in aws_s3_bucket.this : key => bucket.arn }
  control_parameter_arns = [for parameter in aws_ssm_parameter.control : parameter.arn]
  secret_arns            = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
  metrics_condition = {
    test     = "StringEquals"
    variable = "cloudwatch:namespace"
    values   = [local.namespace]
  }
}

data "aws_iam_policy_document" "lambda_trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each = toset(["response", "tracking"])

  name               = "${local.name}-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.lambda_trust.json
  tags               = local.tags
}

data "aws_iam_policy_document" "response" {
  statement {
    sid       = "WriteIntakeAndClaimLinks"
    actions   = ["s3:PutObject"]
    resources = ["${local.bucket_arn["intake"]}/intake/*", "${local.bucket_arn["used_records"]}/links/*"]
  }
  statement {
    sid       = "ReadLinkClaims"
    actions   = ["s3:GetObject"]
    resources = ["${local.bucket_arn["used_records"]}/links/*"]
  }
  statement {
    sid       = "DeleteOwnAnswerFile"
    actions   = ["s3:DeleteObject"]
    resources = ["${local.bucket_arn["intake"]}/intake/answers/*"]
  }
  statement {
    sid       = "Secrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for name in local.secret_readers.response : local.secret_arns[name]]
  }
  statement {
    sid       = "Controls"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = local.control_parameter_arns
  }
  statement {
    sid       = "Metrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = local.metrics_condition.test
      variable = local.metrics_condition.variable
      values   = local.metrics_condition.values
    }
  }
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.lambda["response"].arn}:*"]
  }
}

data "aws_iam_policy_document" "tracking" {
  statement {
    sid       = "UsedRecords"
    actions   = ["s3:GetObject", "s3:PutObject"]
    resources = ["${local.bucket_arn["used_records"]}/links/*", "${local.bucket_arn["used_records"]}/receipts/*"]
  }
  statement {
    sid       = "MissingRecordsAre404"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn["used_records"]]
  }
  statement {
    sid       = "CompletionMessages"
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.completion.arn]
  }
  statement {
    sid       = "Secrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for name in local.secret_readers.tracking : local.secret_arns[name]]
  }
  statement {
    sid       = "Controls"
    actions   = ["ssm:GetParameter", "ssm:GetParameters"]
    resources = local.control_parameter_arns
  }
  statement {
    sid       = "Metrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = local.metrics_condition.test
      variable = local.metrics_condition.variable
      values   = local.metrics_condition.values
    }
  }
  statement {
    sid       = "Logs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.lambda["tracking"].arn}:*"]
  }
}

resource "aws_iam_role_policy" "lambda" {
  for_each = { response = data.aws_iam_policy_document.response.json, tracking = data.aws_iam_policy_document.tracking.json }

  name   = "${local.name}-${each.key}"
  role   = aws_iam_role.lambda[each.key].id
  policy = each.value
}

# Attached by the separate hosting plan to DistrictWorkflow's identity.
data "aws_iam_policy_document" "district_workflow" {
  statement {
    sid       = "ImportIntake"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn["intake"]]
  }
  statement {
    sid       = "ReadAndDeleteIntake"
    actions   = ["s3:GetObject", "s3:DeleteObject"]
    resources = ["${local.bucket_arn["intake"]}/*"]
  }
  statement {
    sid       = "Archive"
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${local.bucket_arn["archive"]}/*"]
  }
  statement {
    sid       = "Queues"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"]
    resources = [aws_sqs_queue.completion.arn, aws_sqs_queue.email_feedback.arn]
  }
  statement {
    sid       = "Controls"
    actions   = ["ssm:PutParameter"]
    resources = local.control_parameter_arns
  }
  statement {
    sid       = "Metrics"
    actions   = ["cloudwatch:PutMetricData"]
    resources = ["*"]
    condition {
      test     = local.metrics_condition.test
      variable = local.metrics_condition.variable
      values   = local.metrics_condition.values
    }
  }
  statement {
    sid       = "ImportAlarms"
    actions   = ["cloudwatch:EnableAlarmActions", "cloudwatch:DisableAlarmActions"]
    resources = [for alarm in aws_cloudwatch_metric_alarm.import : alarm.arn]
  }
  statement {
    sid       = "SurveyEmail"
    actions   = ["ses:SendEmail"]
    resources = ["arn:aws:ses:${local.region}:${local.account_id}:identity/*", aws_sesv2_configuration_set.survey.arn]
  }
  statement {
    sid       = "CloseDownListing"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn["used_records"], local.bucket_arn["survey_site"]]
  }
  statement {
    sid       = "CloseDownDeletion"
    actions   = ["s3:DeleteObject"]
    resources = ["${local.bucket_arn["used_records"]}/*", "${local.bucket_arn["survey_site"]}/*"]
  }
  statement {
    sid       = "CloseDownKeys"
    actions   = ["secretsmanager:DeleteSecret"]
    resources = [for name in local.secret_readers.close_down : local.secret_arns[name]]
  }
}

resource "aws_iam_policy" "district_workflow" {
  name   = "${local.name}-district-workflow"
  policy = data.aws_iam_policy_document.district_workflow.json
  tags   = local.tags
}

# Attached by the separate hosting plan to DistrictStatistics' identity.
data "aws_iam_policy_document" "district_statistics" {
  statement {
    sid       = "PublishResults"
    actions   = ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"]
    resources = ["${local.bucket_arn["results"]}/results-data/*"]
  }
  statement {
    sid       = "RestoreArchives"
    actions   = ["s3:GetObject"]
    resources = ["${local.bucket_arn["archive"]}/*"]
  }
}

resource "aws_iam_policy" "district_statistics" {
  name   = "${local.name}-district-statistics"
  policy = data.aws_iam_policy_document.district_statistics.json
  tags   = local.tags
}

# GitHub Actions deploy roles. Each trusts one repository and one subject: refs/heads/main for test,
# and the production environment, which needs approval, for prod.
data "aws_iam_policy_document" "deploy_trust" {
  for_each = { survey = var.github_repository, statistics = var.statistics_repository }

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.github_oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${each.value}:${var.allowed_deploy_refs[each.key]}"]
    }
  }
}

resource "aws_iam_role" "deploy" {
  for_each = data.aws_iam_policy_document.deploy_trust

  name                 = "${local.name}-${each.key}-deploy"
  assume_role_policy   = each.value.json
  max_session_duration = 3600
  tags                 = local.tags
}

data "aws_iam_policy_document" "survey_deploy" {
  statement {
    sid       = "SiteFiles"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.bucket_arn["survey_site"]}/*"]
  }
  statement {
    sid       = "SiteListing"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn["survey_site"]]
  }
  statement {
    sid       = "LambdaCode"
    actions   = ["lambda:UpdateFunctionCode", "lambda:GetFunctionConfiguration"]
    resources = [for function in aws_lambda_function.this : function.arn]
  }
  statement {
    sid       = "Invalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.survey.arn]
  }
}

data "aws_iam_policy_document" "results_deploy" {
  statement {
    sid       = "SiteFiles"
    actions   = ["s3:PutObject", "s3:DeleteObject"]
    resources = ["${local.bucket_arn["results_site"]}/*"]
  }
  statement {
    sid       = "SiteListing"
    actions   = ["s3:ListBucket"]
    resources = [local.bucket_arn["results_site"]]
  }
  statement {
    sid       = "Invalidate"
    actions   = ["cloudfront:CreateInvalidation"]
    resources = [aws_cloudfront_distribution.results.arn]
  }
}

resource "aws_iam_role_policy" "deploy" {
  for_each = { survey = data.aws_iam_policy_document.survey_deploy.json, statistics = data.aws_iam_policy_document.results_deploy.json }

  name   = "${local.name}-${each.key}-deploy"
  role   = aws_iam_role.deploy[each.key].id
  policy = each.value
}
