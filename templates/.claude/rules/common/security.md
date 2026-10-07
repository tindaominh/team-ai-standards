# Security

- Secrets come from AWS Secrets Manager or SSM at runtime, through the config module. Never hardcode them or commit them.
- Validate config at startup and fail fast if a required value is missing.
- Validate every external input at the boundary (HTTP body, query, headers, webhook payloads, marketplace responses, CSV/XML feeds) with a schema.
- Use parameterised queries or the TypeORM query builder. Never build SQL by string concatenation with input.
- Verify webhook signatures and reject old timestamps (replay window).
- Outbound HTTP only to configured, allowlisted hosts. Never fetch a URL taken from user input without validation (SSRF).
- Error responses must not expose stack traces, SQL or internal IDs of other tenants.
- New dependencies need developer approval: check licence, maintenance and `npm audit`.
- If you find a security problem, stop and report it with location and impact before continuing.
