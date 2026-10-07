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

- Read and edit infrastructure code; never apply it (no deploy, `apply`, or mutating AWS CLI command).
- IAM: one task role per ECS service, least privilege, specific ARNs. No `*` actions on `*`.
- Secrets reach containers through ECS `secrets` from Secrets Manager/SSM, never plain `environment` values.
- RDS: private subnets, encrypted, `deletion_protection` on, backups on.
- S3: Block Public Access, encryption, bucket policy limited to service roles, no personal data in object keys.
- CloudWatch: explicit log retention; no secrets or personal data in logs; alarms for sync lag, DLQ depth, error rate.
- Containers: pinned base image, non-root user, health check, `.dockerignore` excludes `.env*` and `.git`.
- CI assumes AWS roles through GitHub OIDC; no long-lived keys.
- Migrations run as a one-off ECS task before the new version starts.
