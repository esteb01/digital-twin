# AI Digital Twin — serverless conversational assistant

Live site: https://erhdigitaltwin.com
Public repository: https://github.com/esteb01/digital-twin

This project is a conversational assistant that answers questions about Esteban Ruiz's professional background. It is not the robotics thesis. The thesis has its own official title and repository (TFM_Surrogate_Robot).

## Architecture

- Frontend: Next.js static export on S3 + CloudFront
- API: FastAPI on AWS Lambda. The site chat streams over a Lambda Function URL (`POST /chat/stream`). `POST /chat` JSON remains for eval.
- Model: Amazon Bedrock on-demand (Nova Micro in the minimal cost tier)
- Memory: conversation history in a private S3 bucket
- Infrastructure: 100% Terraform
- CI/CD: GitHub Actions, including a controlled destroy workflow for cost control

## Retrieval (RAG)

Career documents (thesis README, CV/Resume, this project note) are chunked and embedded offline with Amazon Titan Text Embeddings V2. Vectors live in Amazon S3 Vectors. At chat time the Lambda queries the index and sends only the top chunks to the model. Indexing is a separate job, not done on every visitor message.

## Cost guardrail

A monthly AWS Budget ($30) emails at 50/80/100%. At 100% a Budget Action attaches an IAM deny for Bedrock on the Lambda role. CloudWatch alarms fire if Lambda or Bedrock exceed 200 invocations in an hour. Day-to-day cost_tier is minimal (no provisioned concurrency, no Nova Pro).

## What this twin can talk about

- The official TFM title, metrics (R² 0.933, 17,301x, PINN recall), and KUKA IIWA setup
- Work at Managing Innovation Strategies, Getecsa / Internet Brands, Hammerbyte, Oracle ONE (past roles; not a current employer)
- How this AWS project itself is built
- Public GitHub activity on esteb01/digital-twin and esteb01/TFM_Surrogate_Robot
