# Data handling (confidential)

This repository may contain client code and handles customer data. These rules override convenience.

- Never read, print or ask for: `.env*` files, credentials, private keys, tokens, AWS secrets or SSM parameters, production database dumps or exports.
- Never run commands that reveal secrets (`env`, `printenv`, `aws secretsmanager get-secret-value`, `aws ssm get-parameter --with-decryption`).
- Never query production databases, production logs or production S3 buckets. Work with local or test data only.
- Test fixtures use synthetic data: fake names, `example.com` emails, `+84 000 000 000`-style phones, fake addresses. Never copy real orders or customers into fixtures, prompts or docs.
- If you see a real secret or personal data (in code, logs, a pasted message or a file), stop. Tell the developer where it is and do not repeat the value.
- Logs and error messages must not contain personal data (name, phone, email, address) or secrets. Log IDs instead (order ID, SKU, tenant ID).
- Do not send repository content to external services: no web search with client names, client domain terms or code snippets. Generic technical queries only.
- Do not add MCP servers, plugins or external tools. Ask the developer.
- Keep each tenant's data isolated. Every query on tenant data filters by tenant.
