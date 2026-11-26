# Survey emails are sent by DistrictWorkflow with this configuration set. It records send, delivery,
# bounce and complaint events only: open and click tracking stay off.
resource "aws_sesv2_configuration_set" "survey" {
  configuration_set_name = local.name

  delivery_options {
    tls_policy = "REQUIRE"
  }

  reputation_options {
    reputation_metrics_enabled = true
  }

  sending_options {
    sending_enabled = true
  }

  tags = local.tags
}

resource "aws_sns_topic" "email_feedback" {
  name              = "${local.name}-email-feedback"
  kms_master_key_id = "alias/aws/sns"
  tags              = local.tags
}

data "aws_iam_policy_document" "email_feedback_topic" {
  statement {
    sid       = "AllowSesEvents"
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.email_feedback.arn]
    principals {
      type        = "Service"
      identifiers = ["ses.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceAccount"
      values   = [local.account_id]
    }
  }
}

resource "aws_sns_topic_policy" "email_feedback" {
  arn    = aws_sns_topic.email_feedback.arn
  policy = data.aws_iam_policy_document.email_feedback_topic.json
}

resource "aws_sesv2_configuration_set_event_destination" "survey" {
  configuration_set_name = aws_sesv2_configuration_set.survey.configuration_set_name
  event_destination_name = "feedback"

  event_destination {
    enabled              = true
    matching_event_types = ["SEND", "DELIVERY", "BOUNCE", "COMPLAINT"]

    sns_destination {
      topic_arn = aws_sns_topic.email_feedback.arn
    }
  }
}

resource "aws_sqs_queue" "email_feedback" {
  name                      = "${local.name}-email-feedback"
  message_retention_seconds = 1209600
  sqs_managed_sse_enabled   = true
  tags                      = local.tags
}

data "aws_iam_policy_document" "email_feedback_queue" {
  statement {
    actions   = ["sqs:SendMessage"]
    resources = [aws_sqs_queue.email_feedback.arn]
    principals {
      type        = "Service"
      identifiers = ["sns.amazonaws.com"]
    }
    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_sns_topic.email_feedback.arn]
    }
  }
}

resource "aws_sqs_queue_policy" "email_feedback" {
  queue_url = aws_sqs_queue.email_feedback.id
  policy    = data.aws_iam_policy_document.email_feedback_queue.json
}

resource "aws_sns_topic_subscription" "email_feedback" {
  topic_arn            = aws_sns_topic.email_feedback.arn
  protocol             = "sqs"
  endpoint             = aws_sqs_queue.email_feedback.arn
  raw_message_delivery = true
}
