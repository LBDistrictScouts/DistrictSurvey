locals {
  aliases = {
    survey  = { name = var.survey_domain, distribution = aws_cloudfront_distribution.survey }
    results = { name = var.results_domain, distribution = aws_cloudfront_distribution.results }
  }
  alias_records = { for pair in setproduct(keys(local.aliases), ["A", "AAAA"]) : "${pair[0]}-${pair[1]}" => { site = pair[0], type = pair[1] } }
}

resource "aws_route53_record" "alias" {
  for_each = local.alias_records

  zone_id = var.route53_zone_id
  name    = local.aliases[each.value.site].name
  type    = each.value.type

  alias {
    name                   = local.aliases[each.value.site].distribution.domain_name
    zone_id                = local.aliases[each.value.site].distribution.hosted_zone_id
    evaluate_target_health = false
  }
}
