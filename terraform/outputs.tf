output "api_gateway_url" {
  description = "URL of the API Gateway"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "cloudfront_url" {
  description = "URL of the CloudFront distribution"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "s3_frontend_bucket" {
  description = "Name of the S3 bucket for frontend"
  value       = aws_s3_bucket.frontend.id
}

output "s3_memory_bucket" {
  description = "Name of the S3 bucket for memory storage"
  value       = aws_s3_bucket.memory.id
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.api.function_name
}

output "custom_domain_url" {
  description = "Root URL of the production site"
  value       = var.use_custom_domain ? "https://${var.root_domain}" : ""
}

output "cost_tier" {
  description = "Active cost tier (minimal or enhanced)"
  value       = var.cost_tier
}

output "bedrock_model_id_effective" {
  description = "Bedrock model actually used after applying cost_tier"
  value       = local.cost.bedrock_model_id
}

output "monthly_budget_name" {
  description = "AWS Budget that alerts at 50/80/100% and attaches the Bedrock deny policy at 100%"
  value       = aws_budgets_budget.monthly.name
}

output "cost_alarm_names" {
  description = "CloudWatch invocation-rate alarms"
  value = [
    aws_cloudwatch_metric_alarm.lambda_invocations.alarm_name,
    aws_cloudwatch_metric_alarm.bedrock_invocations.alarm_name
  ]
}

output "s3_vector_bucket" {
  description = "S3 Vectors bucket used for career RAG"
  value       = aws_s3vectors_vector_bucket.rag.vector_bucket_name
}

output "s3_vector_index" {
  description = "S3 Vectors index name"
  value       = aws_s3vectors_index.rag.index_name
}