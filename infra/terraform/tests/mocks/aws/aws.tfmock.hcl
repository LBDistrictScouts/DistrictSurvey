mock_data "aws_caller_identity" {
  defaults = { account_id = "123456789012" }
}

mock_data "aws_region" {
  defaults = { region = "eu-west-1", name = "eu-west-1" }
}

mock_data "aws_iam_policy_document" {
  defaults = { json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}" }
}

mock_resource "aws_s3_bucket" {
  defaults = { arn = "arn:aws:s3:::district-survey-mock", bucket_regional_domain_name = "district-survey-mock.s3.eu-west-1.amazonaws.com" }
}

mock_resource "aws_cloudfront_distribution" {
  defaults = { arn = "arn:aws:cloudfront::123456789012:distribution/EMOCK", domain_name = "dmock.cloudfront.net", hosted_zone_id = "Z2FDTNDATAQYW2" }
}

mock_resource "aws_cloudfront_function" {
  defaults = { arn = "arn:aws:cloudfront::123456789012:function/mock" }
}

mock_resource "aws_apigatewayv2_api" {
  defaults = { api_endpoint = "https://mock.execute-api.eu-west-1.amazonaws.com", execution_arn = "arn:aws:execute-api:eu-west-1:123456789012:mock" }
}

mock_resource "aws_lambda_function" {
  defaults = {
    arn        = "arn:aws:lambda:eu-west-1:123456789012:function:mock"
    invoke_arn = "arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:123456789012:function:mock/invocations"
  }
}

mock_resource "aws_iam_role" {
  defaults = { arn = "arn:aws:iam::123456789012:role/mock" }
}

mock_resource "aws_iam_policy" {
  defaults = { arn = "arn:aws:iam::123456789012:policy/mock" }
}

mock_resource "aws_sqs_queue" {
  defaults = { arn = "arn:aws:sqs:eu-west-1:123456789012:mock", url = "https://sqs.eu-west-1.amazonaws.com/123456789012/mock" }
}

mock_resource "aws_sns_topic" {
  defaults = { arn = "arn:aws:sns:eu-west-1:123456789012:mock" }
}

mock_resource "aws_cloudwatch_log_group" {
  defaults = { arn = "arn:aws:logs:eu-west-1:123456789012:log-group:mock" }
}

mock_resource "aws_cloudwatch_metric_alarm" {
  defaults = { arn = "arn:aws:cloudwatch:eu-west-1:123456789012:alarm:mock" }
}

mock_resource "aws_secretsmanager_secret" {
  defaults = { arn = "arn:aws:secretsmanager:eu-west-1:123456789012:secret:mock" }
}

mock_resource "aws_ssm_parameter" {
  defaults = { arn = "arn:aws:ssm:eu-west-1:123456789012:parameter/mock" }
}

mock_resource "aws_sesv2_configuration_set" {
  defaults = { arn = "arn:aws:ses:eu-west-1:123456789012:configuration-set/mock" }
}

mock_resource "aws_wafv2_web_acl" {
  defaults = { arn = "arn:aws:wafv2:us-east-1:123456789012:global/webacl/mock/00000000-0000-0000-0000-000000000000" }
}
