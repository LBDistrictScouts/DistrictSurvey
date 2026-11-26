mock_provider "aws" {
  source = "./tests/mocks/aws"
}

mock_provider "aws" {
  alias  = "us_east"
  source = "./tests/mocks/aws"
}

mock_provider "cloudflare" {
  source = "./tests/mocks/cloudflare"
}

mock_provider "random" {
  mock_resource "random_password" {
    defaults = { result = "mockoriginheadervaluemockoriginheadervalue123456" }
  }
}

mock_provider "archive" {}

variables {
  environment               = "test"
  survey_domain             = "survey-test.example.org"
  results_domain            = "results-test.example.org"
  route53_zone_id           = "Z0000000000000000000"
  survey_certificate_arn    = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000001"
  results_certificate_arn   = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000002"
  cloudflare_account_id     = "0123456789abcdef0123456789abcdef"
  alert_topic_arn           = "arn:aws:sns:eu-west-1:123456789012:digital-team"
  alert_topic_arn_us_east   = "arn:aws:sns:us-east-1:123456789012:digital-team"
  github_oidc_provider_arn  = "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
  github_repository         = "ExampleOrg/DistrictSurvey"
  statistics_repository     = "ExampleOrg/DistrictStatistics"
  allowed_deploy_refs       = { survey = "ref:refs/heads/main", statistics = "ref:refs/heads/main" }
  cloudfront_public_key_pem = "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAexample\n-----END PUBLIC KEY-----\n"
  firewall_enabled          = true
}

run "buckets_are_private_and_encrypted" {
  command = apply

  assert {
    condition     = length(aws_s3_bucket.this) == 6
    error_message = "The module creates the survey site, results site, intake, used-records, archive and results buckets."
  }

  assert {
    condition = alltrue([for block in aws_s3_bucket_public_access_block.this :
      block.block_public_acls && block.block_public_policy && block.ignore_public_acls && block.restrict_public_buckets
    ])
    error_message = "Every bucket must block all public access."
  }

  assert {
    condition     = alltrue([for config in aws_s3_bucket_server_side_encryption_configuration.this : one(config.rule).apply_server_side_encryption_by_default[0].sse_algorithm == "AES256"])
    error_message = "Every bucket must use server-side encryption."
  }

  assert {
    condition     = alltrue([for controls in aws_s3_bucket_ownership_controls.this : one(controls.rule).object_ownership == "BucketOwnerEnforced"])
    error_message = "Bucket ACLs must be disabled."
  }

  assert {
    condition     = length(aws_s3_bucket_policy.this) == 6
    error_message = "Every bucket needs a policy that refuses insecure transport."
  }
}

override_resource {
  target = aws_s3_bucket.this["intake"]
  values = { arn = "arn:aws:s3:::intake-mock", id = "intake-mock" }
}

override_resource {
  target = aws_s3_bucket.this["archive"]
  values = { arn = "arn:aws:s3:::archive-mock", id = "archive-mock" }
}

# The module declares one versioning resource, for the archive bucket, so the intake bucket keeps no
# versions and deleting an imported file removes it.
run "intake_versioning_is_off" {
  command = apply

  assert {
    condition     = aws_s3_bucket_versioning.archive.bucket == "archive-mock" && aws_s3_bucket_versioning.archive.bucket != aws_s3_bucket.this["intake"].id
    error_message = "Only the archive bucket keeps versions."
  }

  assert {
    condition     = aws_s3_bucket_versioning.archive.versioning_configuration[0].status == "Enabled"
    error_message = "The archive bucket keeps versions while a batch is verified."
  }
}

run "prod_buckets_are_not_force_destroyed" {
  command = plan

  variables {
    environment = "prod"
  }

  assert {
    condition     = alltrue([for bucket in aws_s3_bucket.this : !bucket.force_destroy])
    error_message = "Production buckets must not be deleted with their contents."
  }

  assert {
    condition     = aws_s3_bucket.this["intake"].bucket == "district-survey-prod-intake-123456789012"
    error_message = "Bucket names include the environment and account."
  }
}
