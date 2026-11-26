# One Turnstile widget, limited to the survey domain. Its secret is held in Terraform state and copied
# into the response Lambda's secret.
resource "cloudflare_turnstile_widget" "survey" {
  account_id = var.cloudflare_account_id
  name       = local.name
  domains    = [var.survey_domain]
  mode       = "managed"
  region     = "world"
}

resource "aws_secretsmanager_secret_version" "turnstile" {
  secret_id     = aws_secretsmanager_secret.this["turnstile-secret"].id
  secret_string = cloudflare_turnstile_widget.survey.secret
}
