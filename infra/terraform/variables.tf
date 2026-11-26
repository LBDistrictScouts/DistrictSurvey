variable "environment" {
  description = "Which environment this instance is: test or prod. Each has its own resources, keys and permissions."
  type        = string

  validation {
    condition     = contains(["test", "prod"], var.environment)
    error_message = "environment must be test or prod."
  }
}

variable "survey_domain" {
  description = "Domain of the survey site, such as survey.example.org."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.survey_domain))
    error_message = "survey_domain must be a lower-case domain name."
  }
}

variable "results_domain" {
  description = "Domain of the data-viz results site, such as results.example.org."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.results_domain))
    error_message = "results_domain must be a lower-case domain name."
  }
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone that holds both domains."
  type        = string
}

variable "survey_certificate_arn" {
  description = "ACM certificate in us-east-1 for survey_domain."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.survey_certificate_arn))
    error_message = "survey_certificate_arn must be an ACM certificate in us-east-1, as CloudFront requires."
  }
}

variable "results_certificate_arn" {
  description = "ACM certificate in us-east-1 for results_domain."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:us-east-1:[0-9]{12}:certificate/", var.results_certificate_arn))
    error_message = "results_certificate_arn must be an ACM certificate in us-east-1, as CloudFront requires."
  }
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the Turnstile widget."
  type        = string
}

variable "alert_topic_arn" {
  description = "Digital team SNS topic in eu-west-1 for every eu-west-1 alarm."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:sns:eu-west-1:", var.alert_topic_arn))
    error_message = "alert_topic_arn must be an SNS topic in eu-west-1."
  }
}

variable "alert_topic_arn_us_east" {
  description = "Digital team SNS topic in us-east-1 for CloudFront and firewall alarms."
  type        = string

  validation {
    condition     = can(regex("^arn:aws:sns:us-east-1:", var.alert_topic_arn_us_east))
    error_message = "alert_topic_arn_us_east must be an SNS topic in us-east-1."
  }
}

variable "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC provider, created by the root configuration."
  type        = string
}

variable "github_repository" {
  description = "The DistrictSurvey repository as owner/name. Its deploy workflow may assume the survey deploy role."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must be owner/name."
  }
}

variable "statistics_repository" {
  description = "The DistrictStatistics repository as owner/name. Its CI may assume the results deploy role."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.statistics_repository))
    error_message = "statistics_repository must be owner/name."
  }
}

variable "allowed_deploy_refs" {
  description = "The GitHub OIDC subject that may deploy, by repository: refs/heads/main for test, and the production environment for prod."
  type        = map(string)

  validation {
    condition     = alltrue([for subject in values(var.allowed_deploy_refs) : can(regex("^(ref:refs/heads/main|ref:refs/tags/v\\*|environment:production)$", subject))])
    error_message = "allowed_deploy_refs values must be ref:refs/heads/main, ref:refs/tags/v* or environment:production."
  }

  validation {
    condition     = length(setsubtract(keys(var.allowed_deploy_refs), ["survey", "statistics"])) == 0 && length(var.allowed_deploy_refs) == 2
    error_message = "allowed_deploy_refs must have exactly the keys survey and statistics."
  }
}

variable "cloudfront_public_key_pem" {
  description = "Public half of the CloudFront cookie key, from yarn secrets:create --generate."
  type        = string

  validation {
    condition     = startswith(trimspace(var.cloudfront_public_key_pem), "-----BEGIN PUBLIC KEY-----")
    error_message = "cloudfront_public_key_pem must be a PEM public key."
  }
}

variable "staff_edge_function_arn" {
  description = <<-EOT
    Qualified ARN of the Lambda@Edge version that checks staff sign-in for /staff-data/*, built by
    DistrictInfrastructure from modules/members-area/edge with the survey-analyst and survey-admin groups.
    Null leaves /staff-data/* closed to everyone.
  EOT
  type        = string
  default     = null

  validation {
    condition     = var.staff_edge_function_arn == null || can(regex("^arn:aws:lambda:us-east-1:[0-9]{12}:function:[A-Za-z0-9_-]+:[0-9]+$", var.staff_edge_function_arn))
    error_message = "staff_edge_function_arn must be a numbered version of a us-east-1 Lambda function."
  }
}

variable "firewall_enabled" {
  description = "Turns on the CloudFront web ACL and its rate rule on /api/v1/responses/open, for the survey period."
  type        = bool
  default     = false
}

variable "limits" {
  description = "API Gateway rate and burst for each response route, and the web ACL limit per IP address per 5 minutes. Set from audience sizes and confirmed by the load test."
  type = object({
    rate                       = number
    burst                      = number
    waf_requests_per_5_minutes = number
  })
  default = {
    rate                       = 10
    burst                      = 20
    waf_requests_per_5_minutes = 100
  }

  validation {
    condition     = var.limits.rate > 0 && var.limits.burst >= var.limits.rate && var.limits.waf_requests_per_5_minutes >= 10
    error_message = "limits needs a positive rate, a burst at least the rate, and a web ACL limit of at least 10."
  }
}

variable "abuse_alarm_threshold" {
  description = "Turnstile rejections in 5 minutes that raise the open-link abuse alarm. Set from audience sizes."
  type        = number
  default     = 20
}

variable "origin_header_active" {
  description = "Which of the two origin header values CloudFront sends. Both are accepted, so a value can be replaced and then switched to."
  type        = string
  default     = "a"

  validation {
    condition     = contains(["a", "b"], var.origin_header_active)
    error_message = "origin_header_active must be a or b."
  }
}

variable "lambda_runtime" {
  description = "Node.js runtime for both Lambdas."
  type        = string
  default     = "nodejs24.x"

  validation {
    condition     = contains(["nodejs22.x", "nodejs24.x"], var.lambda_runtime)
    error_message = "lambda_runtime must be nodejs22.x or nodejs24.x."
  }
}
