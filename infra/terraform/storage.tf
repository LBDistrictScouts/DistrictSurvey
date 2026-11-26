# Six private, encrypted buckets. Access logs are off everywhere, so no store records who visited.
locals {
  buckets = {
    survey_site  = "survey-site"
    results_site = "results-site"
    intake       = "intake"
    used_records = "used-records"
    archive      = "archive"
    results      = "results"
  }
}

resource "aws_s3_bucket" "this" {
  for_each = local.buckets

  bucket        = "${local.name}-${each.value}-${local.account_id}"
  force_destroy = var.environment == "test"
  tags          = local.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  for_each = aws_s3_bucket.this

  bucket                  = each.value.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Versioning stays off on the intake bucket, so deleting an imported file removes it.
# The archive bucket keeps versions while a batch is verified.
resource "aws_s3_bucket_versioning" "archive" {
  bucket = aws_s3_bucket.this["archive"].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "archive" {
  bucket = aws_s3_bucket.this["archive"].id
  rule {
    id     = "expire-replaced-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 7
    }
  }
}

# Results, survey and results sites are read only through CloudFront.
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${local.name}-s3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

locals {
  cloudfront_readers = {
    survey_site  = [aws_cloudfront_distribution.survey.arn]
    results_site = [aws_cloudfront_distribution.results.arn]
    results      = [aws_cloudfront_distribution.results.arn]
  }
}

data "aws_iam_policy_document" "bucket" {
  for_each = aws_s3_bucket.this

  statement {
    sid       = "DenyInsecureTransport"
    effect    = "Deny"
    actions   = ["s3:*"]
    resources = [each.value.arn, "${each.value.arn}/*"]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }

  dynamic "statement" {
    for_each = contains(keys(local.cloudfront_readers), each.key) ? [1] : []
    content {
      sid       = "CloudFrontRead"
      actions   = ["s3:GetObject", "s3:ListBucket"]
      resources = [each.value.arn, "${each.value.arn}/*"]
      principals {
        type        = "Service"
        identifiers = ["cloudfront.amazonaws.com"]
      }
      condition {
        test     = "StringEquals"
        variable = "AWS:SourceArn"
        values   = local.cloudfront_readers[each.key]
      }
    }
  }
}

resource "aws_s3_bucket_policy" "this" {
  for_each = aws_s3_bucket.this

  bucket = each.value.id
  policy = data.aws_iam_policy_document.bucket[each.key].json

  depends_on = [aws_s3_bucket_public_access_block.this]
}
