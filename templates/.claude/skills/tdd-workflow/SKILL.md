---
name: tdd-workflow
description: Use when implementing any behaviour change or bug fix. Enforces a failing test first, then the minimal change, with recorded command output as evidence for the PR.
---

# TDD workflow

## When to use

Every behaviour change and every bug fix. For pure refactors, run the existing tests before and after instead of writing a new failing test.

## Steps

For each task in the approved plan:

1. **Choose the test level.**
   - Unit test for mapping, pricing, stock or status logic. Build the service with `Test.createTestingModule` and replace repositories with `{ provide: getRepositoryToken(Entity), useValue: mock }`; mock other providers the same way.
   - Integration test (local MySQL container, synthetic fixtures) for repositories, queries, migrations and transactions. Use a test module with `TypeOrmModule.forRootAsync` pointing at the local database.
   - Adapter test with the HTTP client mocked at the network boundary for marketplace calls.
   - Run tests with the commands from the CLAUDE.md table (`<unit-test-cmd>`, `<integration-test-cmd>`).
2. **Write the test first.** Use synthetic data only. Name it after the behaviour.
3. **Run it and confirm it fails for the expected reason.** A compile error or a missing import is not the expected reason; fix that and run again. Record the command and the key failing lines.
4. **Make the smallest production change** that makes the test pass. Do not touch production code before step 3 is recorded.
5. **Run the same test again** and confirm it passes. Then run the module's test suite to catch regressions. Record both.
6. **Refactor** only with all tests green, and re-run them.
7. Repeat for the next task.

## NestJS and TypeORM reference

Unit test: build only the class under test; replace repositories and `DataSource` with mocks.

```ts
const orders = { findOne: jest.fn(), save: jest.fn() };
const manager = { findOneOrFail: jest.fn(), save: jest.fn() };
const moduleRef = await Test.createTestingModule({
  providers: [
    OrderConversionService,
    { provide: getRepositoryToken(Order), useValue: orders },
    { provide: DataSource, useValue: { transaction: jest.fn((work) => work(manager)) } },
  ],
}).compile();
const service = moduleRef.get(OrderConversionService);
```

Transactions live in services. Prefer `dataSource.transaction`; use only the `manager` it provides:

```ts
return this.dataSource.transaction(async (manager) => {
  const order = await manager.findOneOrFail(Order, {
    where: { externalId },
    lock: { mode: 'pessimistic_write' },
  });
  order.status = mapStatus(event.status);
  return manager.save(order);
});
```

When you need manual control, a `QueryRunner` always commits or rolls back, and is always released:

```ts
const runner = this.dataSource.createQueryRunner();
await runner.connect();
await runner.startTransaction();
try {
  // runner.manager...
  await runner.commitTransaction();
} catch (err) {
  await runner.rollbackTransaction();
  throw err;
} finally {
  await runner.release();
}
```

Integration test: a testing module with `TypeOrmModule.forRootAsync` pointing at the local MySQL container, real migrations applied, synthetic fixtures, and a clean database per test file.

## Domain cases to consider

Duplicate event, out-of-order event, partial failure in a batch, marketplace timeout / 429 / 5xx, unknown status or SKU, currency rounding, empty result, tenant isolation.

## Evidence for the PR

Add this block to the PR description (the PR template has a slot for it):

```markdown
### Test evidence
| Task | Test | Failing run (before) | Passing run (after) |
| --- | --- | --- | --- |
| 1 | `src/orders/order-conversion.service.spec.ts` "keeps partial payment pending" | `<unit-test-cmd> src/orders/order-conversion.service.spec.ts` → 1 failed: expected PENDING_PAYMENT, got PAID | same command → 1 passed |
Full suite: `<unit-test-cmd>` → <N> passed, 0 failed
Known gaps: <untested cases and why>
```

Never write a result you did not observe. If a test could not be run, say so and why.
