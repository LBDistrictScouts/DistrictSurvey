# The four switches. They start off; the DistrictWorkflow "Open survey" action switches them on, so
# Terraform ignores their values after creation.
locals {
  controls = toset(["open", "tracked", "survey", "results-cookies"])
}

resource "aws_ssm_parameter" "control" {
  for_each = local.controls

  name        = "/district-survey/${var.environment}/controls/${each.value}"
  description = "District survey ${var.environment}: ${each.value} switch, true or false"
  type        = "String"
  value       = "false"
  tags        = local.tags

  lifecycle {
    ignore_changes = [value]
  }
}
