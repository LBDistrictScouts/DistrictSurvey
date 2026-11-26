# The two Lambdas. Terraform creates them with placeholder code; deploy.yml uploads the real bundles,
# so code changes are ignored here.
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.root}/.terraform-artifacts/${local.name}-placeholder.zip"

  source {
    filename = "index.mjs"
    content  = "export const handler = async () => ({ statusCode: 503, headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ error: 'temporarily_unavailable' }) });\n"
  }
}

locals {
  lambda_environment = {
    response = {
      SURVEY_ENVIRONMENT  = var.environment
      INTAKE_BUCKET       = aws_s3_bucket.this["intake"].id
      USED_RECORDS_BUCKET = aws_s3_bucket.this["used_records"].id
      TURNSTILE_HOSTNAME  = var.survey_domain
    }
    tracking = {
      SURVEY_ENVIRONMENT     = var.environment
      USED_RECORDS_BUCKET    = aws_s3_bucket.this["used_records"].id
      COMPLETION_QUEUE_URL   = aws_sqs_queue.completion.url
      RESULTS_DOMAIN         = var.results_domain
      CLOUDFRONT_KEY_PAIR_ID = aws_cloudfront_public_key.cookies.id
    }
  }
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_environment

  name              = "/aws/lambda/${local.name}-${each.key}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_lambda_function" "this" {
  for_each = local.lambda_environment

  function_name    = "${local.name}-${each.key}"
  role             = aws_iam_role.lambda[each.key].arn
  runtime          = var.lambda_runtime
  architectures    = ["arm64"]
  handler          = "index.handler"
  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256
  memory_size      = 512
  timeout          = 8
  tags             = local.tags

  environment {
    variables = each.value
  }

  logging_config {
    log_format = "Text"
    log_group  = aws_cloudwatch_log_group.lambda[each.key].name
  }

  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }
}

resource "aws_lambda_permission" "api" {
  for_each = aws_lambda_function.this

  statement_id  = "AllowSurveyApi"
  action        = "lambda:InvokeFunction"
  function_name = each.value.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.survey.execution_arn}/*/*"
}
