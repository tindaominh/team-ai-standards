# TypeORM: transactions in tests and code

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

Unit tests mock the repository and `DataSource` (`transaction` calls the callback with a mock manager). Integration tests initialise a `DataSource` against the local {{DB_LABEL}} container, run migrations, use synthetic fixtures and clean the database per test file.
