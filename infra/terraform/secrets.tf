# Empty secret containers. yarn secrets:create --store writes their values, except the Turnstile key
# and the origin header values, which Terraform writes.
locals {
  secret_names = toset([
    "tracked-link-key",
    "link-reference-key",
    "file-name-key",
    "receipt-record-key",
    "tracked-pass-private-key",
    "tracked-pass-public-key",
    "receipt-private-key",
    "receipt-public-key",
    "results-token-private-key",
    "results-token-public-key",
    "cloudfront-cookie-private-key",
    "origin-header",
    "turnstile-secret",
  ])

  # Which identity may read each secret.
  secret_readers = {
    response = ["file-name-key", "tracked-pass-public-key", "receipt-private-key", "turnstile-secret", "origin-header"]
    tracking = ["tracked-link-key", "link-reference-key", "receipt-record-key", "tracked-pass-private-key", "receipt-public-key", "results-token-private-key", "results-token-public-key", "cloudfront-cookie-private-key", "origin-header"]
    # DistrictWorkflow reads its keys from 1Password, but deletes these at close-down: the link and
    # receipt record keys after a survey-admin approves, and the results keys 3 months after closing.
    close_down = ["link-reference-key", "receipt-record-key", "results-token-private-key", "results-token-public-key", "cloudfront-cookie-private-key"]
  }
}

resource "aws_secretsmanager_secret" "this" {
  for_each = local.secret_names

  name                    = "/district-survey/${var.environment}/${each.value}"
  description             = "District survey ${var.environment}: ${each.value}"
  recovery_window_in_days = var.environment == "prod" ? 7 : 0
  tags                    = local.tags
}

# Two origin header values. Both are accepted; CloudFront sends the active one. To rotate, replace the
# inactive value, apply, switch origin_header_active, and apply again.
resource "random_password" "origin_header" {
  for_each = toset(["a", "b"])

  length  = 48
  special = false
}

resource "aws_secretsmanager_secret_version" "origin_header" {
  secret_id     = aws_secretsmanager_secret.this["origin-header"].id
  secret_string = jsonencode([random_password.origin_header["a"].result, random_password.origin_header["b"].result])
}
