# The data-viz results site. Volunteers read /results-data/* with CloudFront signed cookies issued by
# the tracking Lambda. Staff read /staff-data/* after signing in at the edge.
resource "aws_cloudfront_public_key" "cookies" {
  name        = "${local.name}-results-cookies"
  comment     = "Signs volunteer results cookies. Add the new key, then remove the old one."
  encoded_key = var.cloudfront_public_key_pem
}

resource "aws_cloudfront_key_group" "cookies" {
  name  = "${local.name}-results-cookies"
  items = [aws_cloudfront_public_key.cookies.id]
}

resource "aws_cloudfront_cache_policy" "results_data" {
  name        = "${local.name}-results-data"
  comment     = "Honours the results bucket's Cache-Control: releases for a long time, current.json for 60 seconds."
  min_ttl     = 0
  default_ttl = 60
  max_ttl     = 31536000

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "none"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_response_headers_policy" "results" {
  name = "${local.name}-results-headers"

  security_headers_config {
    content_security_policy {
      content_security_policy = local.base_csp
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

resource "aws_cloudfront_distribution" "results" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${local.name} results site"
  aliases             = [var.results_domain]
  default_root_object = "index.html"
  price_class         = "PriceClass_100"
  tags                = local.tags

  origin {
    origin_id                = "site"
    domain_name              = aws_s3_bucket.this["results_site"].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  origin {
    origin_id                = "results"
    domain_name              = aws_s3_bucket.this["results"].bucket_regional_domain_name
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

    custom_header {
      name  = "x-origin-verify"
      value = local.origin_header
    }
  }

  # Public shell pages with no questions or figures.
  default_cache_behavior {
    target_origin_id           = "site"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_optimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.results.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.clean_urls.arn
    }
  }

  # Volunteer results: CloudFront refuses any request without valid signed cookies.
  ordered_cache_behavior {
    path_pattern               = "/results-data/*"
    target_origin_id           = "results"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.results_data.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.results.id
    trusted_key_groups         = [aws_cloudfront_key_group.cookies.id]
  }

  # Staff pages and approved comments, built into the data-viz site under staff-data/.
  # Without a staff edge function, every request is refused.
  ordered_cache_behavior {
    path_pattern               = "/staff-data/*"
    target_origin_id           = "site"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.caching_disabled
    response_headers_policy_id = aws_cloudfront_response_headers_policy.results.id
    dynamic "function_association" {
      for_each = var.staff_edge_function_arn == null ? [aws_cloudfront_function.deny.arn] : []
      content {
        event_type   = "viewer-request"
        function_arn = function_association.value
      }
    }

    dynamic "lambda_function_association" {
      for_each = var.staff_edge_function_arn == null ? [] : [var.staff_edge_function_arn]
      content {
        event_type   = "viewer-request"
        lambda_arn   = lambda_function_association.value
        include_body = false
      }
    }
  }

  ordered_cache_behavior {
    path_pattern               = "/api/results-access"
    target_origin_id           = "api"
    viewer_protocol_policy     = "https-only"
    allowed_methods            = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods             = ["GET", "HEAD"]
    cache_policy_id            = local.caching_disabled
    origin_request_policy_id   = local.all_viewer_except_host
    response_headers_policy_id = aws_cloudfront_response_headers_policy.api.id
  }

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
    acm_certificate_arn      = var.results_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# Refuses every request. It guards /staff-data/* until the staff edge function is attached.
resource "aws_cloudfront_function" "deny" {
  name    = "${local.name}-deny"
  runtime = "cloudfront-js-2.0"
  publish = true
  code    = "function handler(event) { return { statusCode: 403, statusDescription: 'Forbidden' }; }"
}
