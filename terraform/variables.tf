variable "project_name" {
  description = "Name prefix for all resources"
  type        = string
  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "environment" {
  description = "Environment name (dev, test, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "test", "prod"], var.environment)
    error_message = "Environment must be one of: dev, test, prod."
  }
}

variable "bedrock_model_id" {
  description = "Bedrock model ID"
  type        = string
  default     = "eu.amazon.nova-lite-v1:0"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 60
}

variable "use_custom_domain" {
  description = "Attach a custom domain to CloudFront"
  type        = bool
  default     = false
}

variable "root_domain" {
  description = "Apex domain name, e.g. mydomain.com"
  type        = string
  default     = ""
}

variable "cost_tier" {
  description = "Cost profile. Use minimal day-to-day; switch to enhanced for Nova Pro + provisioned concurrency, then back to minimal before 16 Feb 2027."
  type        = string
  default     = "minimal"
  validation {
    condition     = contains(["enhanced", "minimal"], var.cost_tier)
    error_message = "cost_tier must be \"enhanced\" or \"minimal\"."
  }
}

variable "monthly_budget_usd" {
  description = "Hard monthly cost ceiling in USD. Budget alerts fire at 50/80/100% and a deny policy attaches at 100%."
  type        = number
  default     = 30
}

variable "budget_alert_email" {
  description = "Email for budget notifications, the 100% Budget Action, and CloudWatch alarms"
  type        = string
}

variable "invocation_alarm_threshold" {
  description = "Hourly Lambda/Bedrock invocation count that trips the CloudWatch alarm"
  type        = number
  default     = 200
}

variable "embedding_model_id" {
  description = "Bedrock embedding model for offline indexing and query-time retrieval"
  type        = string
  default     = "amazon.titan-embed-text-v2:0"
}

variable "embedding_dimensions" {
  description = "Titan Text Embeddings V2 dimension (256, 512, or 1024)"
  type        = number
  default     = 1024
}

variable "discord_webhook_url" {
  description = "Optional Discord webhook for notify_owner. Leave empty to disable."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_owner" {
  description = "GitHub user whose public repos the twin can query"
  type        = string
  default     = "esteb01"
}