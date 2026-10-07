# Raw driver: tests and transactions

Unit test: the class under test receives a pool (or a repository object built on it); pass a mock.

```ts
const client = { query: jest.fn(), release: jest.fn() };
const pool = { connect: jest.fn(async () => client), query: jest.fn() };
const service = new OrderConversionService(pool as unknown as Pool);
```

Transactions use one client and always release it:

```ts
const client = await this.pool.connect();
try {
  await client.query('BEGIN');
  // client.query(...) with parameters only
  await client.query('COMMIT');
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
}
```

(mysql2: `pool.getConnection()`, `beginTransaction()`, `commit()`, `rollback()`, `release()`.)

Integration test: a local {{DB_LABEL}} container, migrations applied with the repository's tool, synthetic fixtures, tables truncated per test file.
