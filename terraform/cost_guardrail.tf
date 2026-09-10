# Cost guardrail (DIGITAL_TWIN_ROADMAP.md section 0).
# Flip `cost_tier` to upgrade to Nova Pro + Lambda provisioned concurrency,
# and flip it back to "minimal" before the 16 Feb 2027 credit expiry.

locals {
  cost_tier_config = {
    minimal = {
      bedrock_model_id               = var.bedrock_model_id
      lambda_provisioned_concurrency = 0
      monthly_budget_usd             = var.monthly_budget_usd
      invocation_alarm_threshold     = var.invocation_alarm_threshold
    }
    enhanced = {
      bedrock_model_id               = "amazon.nova-pro-v1:0"
      lambda_provisioned_concurrency = 1
      monthly_budget_usd             = var.monthly_budget_usd
      invocation_alarm_threshold     = var.invocation_alarm_threshold
    }
  }

  cost = local.cost_tier_config[var.cost_tier]
}

# --- Budget + automatic kill switch ------------------------------------------------

resource "aws_iam_policy" "cost_killswitch" {
  name        = "${local.name_prefix}-cost-killswitch"
  description = "Deny Bedrock inference so a budget breach stops model spend immediately"
  tags        = local.common_tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyBedrockSpend"
        Effect = "Deny"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:Converse",
          "bedrock:ConverseStream"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_role" "budgets_action" {
  name = "${local.name_prefix}-budgets-action"
  tags = local.common_tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "budgets.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "budgets_action" {
  name = "${local.name_prefix}-budgets-action"
  role = aws_iam_role.budgets_action.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "iam:AttachRolePolicy",
          "iam:DetachRolePolicy"
        ]
        Resource = aws_iam_role.lambda_role.arn
      },
      {
        Effect = "Allow"
        Action = [
          "iam:GetPolicy",
          "iam:GetPolicyVersion"
        ]
        Resource = aws_iam_policy.cost_killswitch.arn
      }
    ]
  })
}

resource "aws_budgets_budget" "monthly" {
  name         = "${local.name_prefix}-monthly-cost"
  budget_type  = "COST"
  limit_amount = tostring(local.cost.monthly_budget_usd)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Track usage even while promotional credits keep the invoice at $0.
  # Card-side alerts already exist as the account budget "Zero-Spend Check" ($1, IncludeCredit=true).
  cost_types {
    include_credit             = false
    include_discount           = true
    include_other_subscription = true
    include_recurring          = true
    include_refund             = true
    include_subscription       = true
    include_support            = true
    include_tax                = true
    include_upfront            = true
    use_amortized              = false
    use_blended                = false
  }

  dynamic "notification" {
    for_each = [50, 80, 100]
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_alert_email]
    }
  }

  tags = local.common_tags
}

resource "aws_budgets_budget_action" "deny_bedrock_at_100" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "APPLY_IAM_POLICY"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budgets_action.arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }

  definition {
    iam_action_definition {
      policy_arn = aws_iam_policy.cost_killswitch.arn
      roles      = [aws_iam_role.lambda_role.name]
    }
  }

  subscriber {
    address           = var.budget_alert_email
    subscription_type = "EMAIL"
  }
}

# --- CloudWatch invocation tripwire ------------------------------------------------
# Email for these alarms needs SNS:TagResource/SetTopicAttributes/ListTagsForResource,
# which aiengineer does not have. Budget 50/80/100% emails still go out via AWS Budgets.

resource "aws_cloudwatch_metric_alarm" "lambda_invocations" {
  alarm_name          = "${local.name_prefix}-lambda-invocations"
  alarm_description   = "Anomalous Lambda traffic for a personal portfolio twin"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Lambda"
  period              = 3600
  statistic           = "Sum"
  threshold           = local.cost.invocation_alarm_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "bedrock_invocations" {
  alarm_name          = "${local.name_prefix}-bedrock-invocations"
  alarm_description   = "Anomalous Bedrock traffic for a personal portfolio twin"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Invocations"
  namespace           = "AWS/Bedrock"
  period              = 3600
  statistic           = "Sum"
  threshold           = local.cost.invocation_alarm_threshold
  treat_missing_data  = "notBreaching"

  dimensions = {
    ModelId = local.cost.bedrock_model_id
  }
}

# --- Enhanced tier only: warm Lambda capacity -------------------------------------

resource "aws_lambda_alias" "live" {
  count            = local.cost.lambda_provisioned_concurrency > 0 ? 1 : 0
  name             = "live"
  function_name    = aws_lambda_function.api.function_name
  function_version = aws_lambda_function.api.version
}

resource "aws_lambda_provisioned_concurrency_config" "enhanced" {
  count                             = local.cost.lambda_provisioned_concurrency > 0 ? 1 : 0
  function_name                     = aws_lambda_function.api.function_name
  qualifier                         = aws_lambda_alias.live[0].name
  provisioned_concurrent_executions = local.cost.lambda_provisioned_concurrency
}

resource "aws_lambda_permission" "api_gw_alias" {
  count         = local.cost.lambda_provisioned_concurrency > 0 ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGatewayAlias"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  qualifier     = aws_lambda_alias.live[0].name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
