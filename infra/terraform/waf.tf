# A CloudFront web ACL with a per-IP rate rule on the open-link response route, switched on for the
# survey period. No application identity can change it.
resource "aws_wafv2_web_acl" "survey" {
  count    = var.firewall_enabled ? 1 : 0
  provider = aws.us_east

  name  = "${local.name}-survey"
  scope = "CLOUDFRONT"
  tags  = local.tags

  default_action {
    allow {}
  }

  rule {
    name     = "open-link-rate"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                 = var.limits.waf_requests_per_5_minutes
        evaluation_window_sec = 300
        aggregate_key_type    = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string         = "/api/v1/responses/open"
            positional_constraint = "EXACTLY"

            field_to_match {
              uri_path {}
            }

            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${local.name}-open-link-rate"
      sampled_requests_enabled   = false
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-survey"
    sampled_requests_enabled   = false
  }
}
