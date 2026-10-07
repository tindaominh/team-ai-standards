---
paths:
  - "infra/**"
  - "cdk/**"
  - "terraform/**"
  - "**/*.tf"
  - "**/task-definition*.json"
  - ".github/workflows/**"
  - "**/Dockerfile*"
---

# AWS and infrastructure

- You may read and edit infrastructure code. You never apply it: no deploy, `apply`, or AWS CLI command that creates, updates or deletes resources.
- IAM: one task role per ECS service, least privilege, specific resource ARNs. No `*` actions on `*` resources.
- Secrets reach containers through ECS `secrets` from Secrets Manager/SSM, never plain `environment` values or images.
- RDS: private subnets only, encryption at rest, `deletion_protection` on, automated backups on.
- S3: Block Public Access on, encryption on, bucket policy limited to the service roles. Object keys contain no personal data.
- CloudWatch: set log retention explicitly. Logs must not contain secrets or personal data. Add alarms for sync lag, DLQ depth and error rate.
- Containers: pinned base image, non-root user, health check, `.dockerignore` excludes `.env*` and `.git`.
- CI uses GitHub OIDC to assume a deploy role. No long-lived AWS keys in GitHub secrets.
- Run migrations as a one-off ECS task before the new service version starts, never on application boot.
