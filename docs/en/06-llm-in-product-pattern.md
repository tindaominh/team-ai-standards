# 06. Pattern: calling an LLM inside the product

## Purpose

Some features may use an LLM at runtime, for example:

- suggesting product attribute mappings between channels,
- normalising messy addresses or option names,
- proposing category matches,
- drafting bulk listing changes from a merchant's instruction.

This document defines the only pattern we use for such features. The model proposes; deterministic code validates; a human approves; existing service code applies; everything is logged and reversible.

## When NOT to use an LLM

Do not use an LLM when:

- A deterministic rule, lookup table, regex or parser can do the job reliably. Try that first; use the LLM only for the leftovers it cannot handle.
- The result must be exact and is checkable by code anyway (totals, stock arithmetic, tax).
- The action is irreversible or has direct financial effect (refunds, price changes applied without review, order cancellation).
- The input would contain personal data or secrets and cannot be reduced or masked.
- No human is available to approve changes in the required time.
- The client has not approved AI processing of its data.

## The pattern

```text
User request / source data
        │
        ▼
 1. Prepare input (minimise, mask personal data)
        │
        ▼
 2. LLM proposes changes as structured JSON
        │
        ▼
 3. Deterministic validator ──fail──► one repair round ──fail──► reject, show reason
        │ pass
        ▼
 4. Human reviews each change (before / after), approves or rejects
        │ approved
        ▼
 5. Staleness check (data unchanged since "before" was read?)
        │ ok
        ▼
 6. Apply through existing service code (same validation, transactions, events)
        │
        ▼
 7. Audit log + revert
```

### 1. Prepare input

- Send only the fields needed for the task. No customer names, phones, emails or addresses unless the feature truly needs them and the security owner approved it.
- Replace identifiers with short local references (`item_1`, `item_2`) and keep the mapping on our side.
- Put a size limit on the input. Batch large sets.

### 2. LLM proposes structured JSON

- The model returns JSON only, matching a strict schema. Free text is not executed or applied.
- The schema contains a **closed set of change types**, for example `set_attribute`, `map_category`, `rename_option`. Nothing outside the set is accepted.
- Every change refers to a target by the reference from step 1 and gives the proposed new value.
- The model does not provide the "before" value. We read it ourselves (step 4).

Example schema (shortened):

```json
{
  "changes": [
    {
      "type": "map_category",
      "target": "item_3",
      "value": { "channelCategoryId": "100234" },
      "reason": "short explanation"
    }
  ]
}
```

### 3. Deterministic validator

The validator is ordinary TypeScript with unit tests. It checks:

- **Schema:** JSON parses and matches the schema exactly. Unknown fields are rejected.
- **Closed set:** `type` is one of the allowed change types.
- **Existing IDs:** every `target` maps to a real record the user may change (tenant check). Every referenced value (category ID, attribute ID) exists in our data or the channel's cached catalogue.
- **Bounds:** lengths, numeric ranges, allowed characters, maximum number of changes per request.
- **Business rules:** the same rules the normal service enforces (for example a price never changes through this flow).
- **Output rebuilt:** the validator builds a new change object from validated fields only. The raw model output is never passed further.

**One repair round:** if validation fails, send the model the list of validation errors once and ask for a corrected JSON. If it fails again, reject the request and show the reasons to the user. No loops.

### 4. Human approval of each change

- Show each change as **before → after**. "Before" is read from our database at this moment, never taken from the model.
- The user approves or rejects each change individually. Bulk approve is allowed only with the full list visible.
- Show the model's short reason, clearly marked as AI-generated.

### 5. Staleness check

- When the user approves, compare the current value with the "before" that was shown (or use a version column).
- If the data changed in between, do not apply. Show the new state and ask again.

### 6. Apply through existing service code

- Approved changes go through the same service methods a normal user action uses: validation, permissions, transactions, domain events and channel sync.
- No separate "AI write path" to the database.

### 7. Audit log and revert

Log per change:

- who requested and who approved,
- the model and prompt version,
- the validated change,
- before and after values,
- the timestamps.

Do not log the raw prompt if it contains customer data. Every applied change can be reverted from the audit record through the same service code.

## Cost and reliability

- Choose the smallest model that meets the quality bar on a test set; measure before moving to a larger one.
- Set a per-request and per-tenant budget. Stop and report when it is exceeded.
- Retry only on transient errors (timeouts, 429, 5xx), with backoff and a limit.
- Use prompt caching for a long, stable system prompt and catalogue context.
- Keep a test set of real-shaped (synthetic) cases. Run it in CI when the prompt, model or schema changes, and track the acceptance rate.

## Checklist before shipping

- [ ] A deterministic approach was tried first; the LLM handles only what remains.
- [ ] Security owner approved the data sent to the model.
- [ ] Input minimised and masked; no personal data unless approved.
- [ ] JSON schema with a closed set of change types.
- [ ] Validator has unit tests for every rule, including malicious and malformed outputs.
- [ ] Exactly one repair round.
- [ ] Before values read from our data; staleness check on apply.
- [ ] Human approves each change.
- [ ] Applied through existing service code.
- [ ] Audit log and revert tested.
- [ ] Budget, timeouts and retries configured.
- [ ] Evaluation test set in CI.
