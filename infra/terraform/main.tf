# Shared names and identifiers used by every file in this module.

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

locals {
  name       = "district-survey-${var.environment}"
  account_id = data.aws_caller_identity.current.account_id
  region     = data.aws_region.current.region
  namespace  = "DistrictSurvey/${var.environment}"
  tags = {
    Application = "district-survey"
    Environment = var.environment
  }
}
