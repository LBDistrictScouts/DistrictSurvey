# Completion messages from the tracking Lambda to DistrictWorkflow. Messages wait up to 14 days.
resource "aws_sqs_queue" "completion_dlq" {
  name                      = "${local.name}-completion-dlq"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = local.tags
}

resource "aws_sqs_queue" "completion" {
  name                       = "${local.name}-completion"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 1209600
  sqs_managed_sse_enabled    = true
  tags                       = local.tags

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.completion_dlq.arn
    maxReceiveCount     = 5
  })
}
