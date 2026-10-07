# NestJS: building the class under test

Unit test: build only the class under test with `Test.createTestingModule` and replace its data-access providers with mocks: TypeORM `getRepositoryToken(Entity)` and `DataSource`, raw drivers your pool provider token.

```ts
const moduleRef = await Test.createTestingModule({
  providers: [
    OrderConversionService,
    { provide: getRepositoryToken(Order), useValue: orders },
    { provide: DataSource, useValue: dataSource },
  ],
}).compile();
const service = moduleRef.get(OrderConversionService);
```

Integration test: a testing module that imports the real data-access module configured for the local {{DB_LABEL}} container, with synthetic fixtures and a clean database per test file.
