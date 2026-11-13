# DeployFlow — End-to-End DevOps Automation Platform

DeployFlow is a learning and portfolio project demonstrating CI, containerization, image security scanning, service health checks, and application monitoring for a Node.js REST API.

## Architecture

GitHub push / pull request → GitHub Actions → tests + lint → Docker image build → Trivy scan.

For local runtime: Docker Compose starts the API, MongoDB, Prometheus, and Grafana.

## Prerequisites

- Git
- Node.js 22 or a compatible recent Node.js release
- Docker Desktop with Docker Compose enabled

## Run locally without Docker (API only)

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start MongoDB locally, or use Docker for MongoDB.
3. Run `npm install`.
4. Run `npm test`.
5. Run `npm start`.
6. Open `http://localhost:3000/health`.

The API can start without MongoDB so that health and metrics endpoints remain available for troubleshooting. CRUD routes return `503` while the database is disconnected.

## Run the complete stack

From the repository root:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Endpoints:

- API: http://localhost:3000
- Health: http://localhost:3000/health
- Prometheus metrics: http://localhost:3000/metrics
- Prometheus UI: http://localhost:9090
- Grafana: http://localhost:3001 (default local username `admin`; password from `GRAFANA_PASSWORD`, default `change-me-local`)

Change the local Grafana password before sharing the project or exposing it to a network. Do not expose these demo ports publicly as-is.

Stop the stack:

```bash
docker compose down
```

Delete local database and Grafana data only if you intentionally want a clean reset:

```bash
docker compose down -v
```

## API examples

Create a task:

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Learn GitHub Actions\",\"description\":\"Finish CI pipeline\"}"
```

List tasks:

```bash
curl http://localhost:3000/api/tasks
```

Update a task (replace `TASK_ID`):

```bash
curl -X PATCH http://localhost:3000/api/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"done\"}"
```

Delete a task (replace `TASK_ID`):

```bash
curl -X DELETE http://localhost:3000/api/tasks/TASK_ID
```

## CI/CD workflow

`.github/workflows/ci-cd.yml` runs on pushes and pull requests targeting `main` or `master`.

1. Install dependencies.
2. Run automated tests and lint.
3. Build the Docker image.
4. Scan the image with Trivy for HIGH and CRITICAL vulnerabilities.

The workflow intentionally does not deploy to a public cloud automatically. Add a protected deployment job only after choosing a host, configuring GitHub Actions secrets, and testing a rollback strategy.

## Monitoring

Prometheus scrapes `/metrics` every 15 seconds. Grafana is provisioned with Prometheus as its default data source. Add dashboard panels for:

- Request rate: `sum(rate(deployflow_http_requests_total[5m]))`
- 5xx rate: `sum(rate(deployflow_http_requests_total{status_code=~"5.."}[5m]))`
- 95th percentile latency: `histogram_quantile(0.95, sum by (le) (rate(deployflow_http_request_duration_seconds_bucket[5m])))`
- API availability: `up{job="deployflow-api"}`

Alerts are defined in `monitoring/alerts.yml`. Prometheus evaluates these rules; a notification receiver (email, Slack, etc.) must be configured separately for delivery.

## Demonstrate failure recovery

1. Change a test expectation so it fails; push a branch and show that CI blocks the image job.
2. Fix the test and push again; verify the pipeline passes.
3. Stop the API container with `docker compose stop api`; check Prometheus for `up{job="deployflow-api"} == 0`.
4. Restart it using `docker compose start api`.
5. Review `docker compose logs api` and document what happened.

## Suggested next improvements

- Add authentication and integration tests with a disposable MongoDB instance.
- Publish versioned images to GitHub Container Registry.
- Add a protected deployment job to a Linux VM with GitHub Actions environment approvals.
- Add a Grafana dashboard JSON export and a configured alert notification channel.
- Add Terraform only after a working deployment exists.

## Evidence checklist for your portfolio

- [ ] Successful GitHub Actions run
- [ ] Deliberately failed test run followed by a successful run
- [ ] Docker Compose services healthy
- [ ] Trivy scan output reviewed
- [ ] Prometheus target up
- [ ] Grafana dashboard with real metrics
- [ ] Recovery test and explanation in `docs/incident-report.md`

## Resume wording

Use only after you have implemented and verified each item:

**DeployFlow — End-to-End DevOps Automation Platform**
- Automated Node.js API testing and linting with GitHub Actions and gated container builds on successful checks.
- Containerized the API and MongoDB using Docker Compose with health checks and persistent storage.
- Integrated Trivy image scanning and exposed application metrics to Prometheus for Grafana-based monitoring.
- Tested pipeline failures and service recovery; documented troubleshooting steps and operational limitations.

## Scope note

This starter includes CI, Docker Compose, Trivy scanning, health checks, Prometheus scraping, and Grafana data-source provisioning. A public cloud deployment, custom Grafana dashboard, alert delivery integration, and a full production-grade rollback system are follow-on tasks, not pre-completed features.
