# RAG store: S3 Vectors + Titan embeddings (DIGITAL_TWIN_ROADMAP.md section 1).
# Indexing is offline (backend/indexer.py / GitHub Actions). Lambda only queries.

resource "aws_s3vectors_vector_bucket" "rag" {
  vector_bucket_name = "${local.name_prefix}-vectors-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3vectors_index" "rag" {
  vector_bucket_name = aws_s3vectors_vector_bucket.rag.vector_bucket_name
  index_name         = "career-knowledge"
  data_type          = "float32"
  dimension          = var.embedding_dimensions
  distance_metric    = "cosine"

  metadata_configuration {
    non_filterable_metadata_keys = ["text"]
  }
}

resource "aws_iam_role_policy" "lambda_s3vectors" {
  name = "${local.name_prefix}-lambda-s3vectors"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "QueryCareerIndex"
        Effect = "Allow"
        Action = [
          "s3vectors:QueryVectors",
          "s3vectors:GetVectors",
          "s3vectors:ListVectors"
        ]
        Resource = [
          aws_s3vectors_vector_bucket.rag.vector_bucket_arn,
          aws_s3vectors_index.rag.index_arn
        ]
      }
    ]
  })
}
