# The survey site and its APIs on one distribution, so the browser only ever talks to one origin.
resource "aws_cloudfront_function" "clean_urls" {
  name    = "${local.name}-clean-urls"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = file("${path.module}/clean-urls.js")
}

locals {
  security_headers = {
    strict_transport_security = "max-age=63072000; includeSubDomains"
    referrer_policy           = "no-referrer"
    permissions_policy        = "camera=(), microphone=(), geolocation=()"
  }
  base_csp      = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  turnstile_csp = "default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  origin_header = var.origin_header_active == "a" ? random_password.origin_header["a"].result : random_password.origin_header["b"].result
  api_origin    = replace(aws_apigatewayv2_api.survey.api_endpoint, "https://", "")

  # AWS managed policies.
  caching_disabled       = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
  caching_optimized      = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  all_viewer_except_host = "b689b0a8-53d0-40ab-baf2-68738e2966ac"
}

resource "aws_cloudfront_response_headers_policy" "survey" {
  for_each = { site = local.base_csp, turnstile = local.turnstile_csp }

  name = "${local.name}-${each.key}-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = each.value
      override                = true
    }
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = local.security_headers.permissions_policy
      override = true
    }
  }
}

resource "aws_cloudfront_response_headers_policy" "api" {
  name = "${local.name}-api-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 63072000
      include_subdomains         = true
      override                   = true
    }
    content_type_options {
      override = true
    }
    referrer_policy {
      referrer_policy = "no-referrer"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "Cache-Control"
      value    = "no-store"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "survey" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} survey site"
  aliases             = [var.survey_domain]
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  web_acl_id          = var.firewall_enabled ? aws_wafv2_web_acl.survey[0].arn : null
  tags                = local.tags

  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.this["survey_site"].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id   = "api"
    domain_name = local.api_origin

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # Both Lambdas refuse requests without this header, so the API cannot be called directly.
    custom_header {
      name  = "x-origin-verify"
      value = local.origin_header
    }
  }

  default_cache_behavior {
    target_origin_id           = "site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.survey["site"].id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.clean_urls.arn
    }
  }

  # Only the open-link page loads Turnstile, so only it allows Cloudflare's scripts and frames.
  ordered_cache_behavior {
    path_pattern               = "/survey*"
    target_origin_id           = "site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.survey["turnstile"].id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.clean_urls.arn
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/*"
    target_origin_id           = "api"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_disabled
    origin_request_policy_id   = local.all_viewer_except_host
    response_headers_policy_id = aws_cloudfront_response_headers_policy.api.id
  }

  # Error pages replace origin errors on every path, so only 404 is mapped: the API's own 403, 409,
  # 422 and 503 bodies reach the browser unchanged. CloudFront may list the site bucket, so a missing
  # page is a 404 rather than a 403.
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.survey_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
