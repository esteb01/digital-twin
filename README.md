# Career digital twin

Live site: [erhdigitaltwin.com](https://erhdigitaltwin.com)

Conversational assistant that answers questions about [Esteban Ruiz](https://www.linkedin.com/in/estebanruizh/)'s public professional record (CV, master's thesis, this project). It is **not** the robotics thesis. That work has its own title and repository: [TFM_Surrogate_Robot](https://github.com/esteb01/TFM_Surrogate_Robot).

I am not in a formal role right now. I build personal AI/ML projects, including this twin. Last formal role: AI Engineer Intern at Managing Innovation Strategies (ended June 2025).

## Stack

- **Frontend:** Next.js static export on S3 + CloudFront. 3D facet graph plus a chat drawer.
- **API:** FastAPI on AWS Lambda (Python 3.12).
- **Chat (browser):** Lambda Function URL + [Lambda Web Adapter](https://github.com/awslabs/aws-lambda-web-adapter), `POST /chat/stream` (SSE from Bedrock `converse_stream`).
- **Chat (eval / JSON):** `POST /chat` returns the full reply. Nightly eval should call the Function URL (`EVAL_API_URL`).
- **Model:** Amazon Bedrock on-demand, Nova Micro (`minimal` cost tier).
- **RAG:** Career docs in `knowledge/` are chunked and embedded offline with Titan Text Embeddings V2 into Amazon S3 Vectors. The Lambda retrieves top chunks per message; indexing is a separate job, not done on every visit.
- **Memory:** conversation history in a private S3 bucket.
- **Infra:** 100% Terraform (`eu-west-3`). GitHub Actions deploys the `dev` workspace; that is the live stack behind erhdigitaltwin.com, not a separate staging site.
- **CI/CD:** GitHub Actions — deploy on push to `main`, index on `knowledge/**` changes, nightly eval, controlled destroy.

## Cost

Monthly AWS Budget **$30**, email at 50/80/100%. At 100% a Budget Action attaches an IAM deny for Bedrock on the Lambda role. CloudWatch alarms fire above 200 Lambda or Bedrock invocations in an hour. Day-to-day `cost_tier` is `minimal` (no provisioned concurrency, no Nova Pro).

## Local

API (from `backend/`, AWS credentials required for Bedrock and S3 Vectors):

```bash
cd backend
uv run python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
echo NEXT_PUBLIC_API_URL=http://localhost:8000 > .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `.env.example` for indexer and eval variables. Deploy and reindex go through GitHub Actions (`scripts/deploy.sh` / `backend/indexer.py`), not on each visitor message.

## What it can talk about

- Official TFM title, metrics (R² 0.933, 17,301×, PINN recall), KUKA IIWA setup
- Managing Innovation Strategies, Getecsa / Internet Brands, Hammerbyte, Oracle ONE (past roles)
- How this AWS project is built and torn down
- Public GitHub activity on `esteb01/digital-twin` and `esteb01/TFM_Surrogate_Robot`
