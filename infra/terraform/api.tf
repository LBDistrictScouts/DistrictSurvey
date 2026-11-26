# One HTTP API for both Lambdas. CloudFront is its only caller: both Lambdas check the origin header.
locals {
  routes = {
    "POST /api/v1/tracking/open"     = "tracking"
    "POST /api/v1/tracking/start"    = "tracking"
    "POST /api/v1/tracking/complete" = "tracking"
    "POST /api/v1/tracking/claim"    = "tracking"
    "POST /api/v1/tracking/decline"  = "tracking"
    "POST /api/results-access"       = "tracking"
    "POST /api/v1/responses/tracked" = "response"
    "POST /api/v1/responses/open"    = "response"
  }
}

resource "aws_apigatewayv2_api" "survey" {
  name          = local.name
  protocol_type = "HTTP"
  tags          = local.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each = aws_lambda_function.this

  api_id                 = aws_apigatewayv2_api.survey.id
  integration_type       = "AWS_PROXY"
  integration_uri        = each.value.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "survey" {
  for_each = local.routes

  api_id    = aws_apigatewayv2_api.survey.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value].id}"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.name}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.survey.id
  name        = "$default"
  auto_deploy = true
  tags        = local.tags

  default_route_settings {
    throttling_rate_limit  = var.limits.rate * 4
    throttling_burst_limit = var.limits.burst * 4
  }

  # Each response route starts at rate 10 and burst 20, adjusted after the load test.
  dynamic "route_settings" {
    for_each = toset(["POST /api/v1/responses/tracked", "POST /api/v1/responses/open"])
    content {
      route_key              = route_settings.value
      throttling_rate_limit  = var.limits.rate
      throttling_burst_limit = var.limits.burst
    }
  }

  # No client IP address, user agent or request body is logged.
  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      routeKey           = "$context.routeKey"
      status             = "$context.status"
      responseLatency    = "$context.responseLatency"
      integrationStatus  = "$context.integrationStatus"
      integrationLatency = "$context.integrationLatency"
    })
  }

  depends_on = [aws_apigatewayv2_route.survey]
}
