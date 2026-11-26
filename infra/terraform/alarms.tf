# Every alarm in "Alarms" in the design. eu-west-1 alarms notify the digital team topic; us-east-1
# alarms notify the us-east-1 topic. Import alarms start with actions off: the DistrictWorkflow "Open
# survey" action enables them and close-down disables them.
locals {
  lambda_alarms = {
    for pair in setproduct(["response", "tracking"], ["Errors", "Throttles"]) : "${pair[0]}-${lower(pair[1])}" => { function = pair[0], metric = pair[1] }
  }

  custom_alarms = {
    completion-send-failed = { metric = "CompletionSendFailed", statistic = "Sum", threshold = 1, period = 300, missing = "notBreaching", description = "The tracking Lambda could not send a completion message." }
    archive-verify-failed  = { metric = "ArchiveVerifyFailed", statistic = "Sum", threshold = 1, period = 300, missing = "notBreaching", description = "An import archive could not be verified. The originals are kept." }
    comment-overdue        = { metric = "CommentOverdue", statistic = "Maximum", threshold = 1, period = 300, missing = "notBreaching", description = "A comment is still open 36 hours after import." }
    release-failed         = { metric = "ReleaseFailed", statistic = "Sum", threshold = 1, period = 300, missing = "notBreaching", description = "A results release failed. Older results remain visible." }
    survey-bounce-rate     = { metric = "SurveyBounceRate", statistic = "Maximum", threshold = 5.000001, period = 3600, missing = "notBreaching", description = "More than 5% of survey emails bounced." }
    open-link-abuse        = { metric = "TurnstileRejected", statistic = "Sum", threshold = var.abuse_alarm_threshold, period = 300, missing = "notBreaching", description = "Unusual Turnstile rejections on the open link." }
  }

  # Missing data is a fault for these: silence means the import has stopped.
  import_alarms = {
    import-stopped = { metric = "ImportHeartbeat", statistic = "Sum", threshold = 1, operator = "LessThanThreshold", period = 3600, periods = 14, description = "No import has finished for 14 hours." }
    intake-backlog = { metric = "OldestIntakeAgeHours", statistic = "Maximum", threshold = 14, operator = "GreaterThanThreshold", period = 3600, periods = 1, description = "An intake file is more than 14 hours old." }
  }
}

resource "aws_cloudwatch_metric_alarm" "api_5xx" {
  alarm_name          = "${local.name}-api-5xx"
  alarm_description   = "The survey API returned 5 or more server errors in 5 minutes."
  namespace           = "AWS/ApiGateway"
  metric_name         = "5xx"
  dimensions          = { ApiId = aws_apigatewayv2_api.survey.id, Stage = "$default" }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alert_topic_arn]
  ok_actions          = [var.alert_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "lambda" {
  for_each = local.lambda_alarms

  alarm_name          = "${local.name}-${each.key}"
  alarm_description   = "The ${each.value.function} Lambda reported ${each.value.metric} in the last 5 minutes."
  namespace           = "AWS/Lambda"
  metric_name         = each.value.metric
  dimensions          = { FunctionName = aws_lambda_function.this[each.value.function].function_name }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alert_topic_arn]
  ok_actions          = [var.alert_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "dead_letters" {
  alarm_name          = "${local.name}-completion-dead-letters"
  alarm_description   = "A completion message failed 5 times and is in the dead-letter queue."
  namespace           = "AWS/SQS"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  dimensions          = { QueueName = aws_sqs_queue.completion_dlq.name }
  statistic           = "Maximum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alert_topic_arn]
  ok_actions          = [var.alert_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "custom" {
  for_each = local.custom_alarms

  alarm_name          = "${local.name}-${each.key}"
  alarm_description   = each.value.description
  namespace           = local.namespace
  metric_name         = each.value.metric
  statistic           = each.value.statistic
  period              = each.value.period
  evaluation_periods  = 1
  threshold           = each.value.threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = each.value.missing
  alarm_actions       = [var.alert_topic_arn]
  ok_actions          = [var.alert_topic_arn]
  tags                = local.tags
}

resource "aws_cloudwatch_metric_alarm" "import" {
  for_each = local.import_alarms

  alarm_name          = "${local.name}-${each.key}"
  alarm_description   = each.value.description
  namespace           = local.namespace
  metric_name         = each.value.metric
  statistic           = each.value.statistic
  period              = each.value.period
  evaluation_periods  = each.value.periods
  datapoints_to_alarm = each.value.periods
  threshold           = each.value.threshold
  comparison_operator = each.value.operator
  treat_missing_data  = "breaching"
  actions_enabled     = false
  alarm_actions       = [var.alert_topic_arn]
  ok_actions          = [var.alert_topic_arn]
  tags                = local.tags

  lifecycle {
    ignore_changes = [actions_enabled]
  }
}

# Blocked requests on the open-link rate rule, in us-east-1 where CloudFront web ACL metrics live.
resource "aws_cloudwatch_metric_alarm" "waf_blocked" {
  count    = var.firewall_enabled ? 1 : 0
  provider = aws.us_east

  alarm_name          = "${local.name}-open-link-blocked"
  alarm_description   = "The web ACL blocked unusual open-link traffic."
  namespace           = "AWS/WAFV2"
  metric_name         = "BlockedRequests"
  dimensions          = { WebACL = aws_wafv2_web_acl.survey[0].name, Rule = "open-link-rate" }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = var.abuse_alarm_threshold
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [var.alert_topic_arn_us_east]
  ok_actions          = [var.alert_topic_arn_us_east]
  tags                = local.tags
}
