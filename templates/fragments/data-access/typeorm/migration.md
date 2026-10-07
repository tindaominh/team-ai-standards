# TypeORM: migrations and configuration

- Generate with the TypeORM CLI (`<migration-generate-cmd>`), then read the SQL: TypeORM sometimes emits DROP/ADD for renames, type, charset or default differences.
- Configuration check: `synchronize` and `migrationsRun` stay `false`; the migration matches the CLI data source's `migrations` glob.
- PostgreSQL `CREATE INDEX CONCURRENTLY`: put it alone in a migration class with `transaction = false`.

## With NestJS

Application module: migrations never run on start.

```ts
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>) => ({
    type: '{{DB_TYPE}}',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USER', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_NAME', { infer: true }),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
  }),
});
```

CLI data source (`src/database/data-source.ts`), used only by the TypeORM CLI and the one-off migration task. New migrations must match its `migrations` glob:

```ts
export default new DataSource({
  type: '{{DB_TYPE}}',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? {{DB_PORT}}),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
});
```

## Without NestJS

One data source module (`src/database/data-source.ts`) is used by the application and by the TypeORM CLI. Migrations never run on start; new migrations must match its `migrations` glob.

```ts
import { DataSource } from 'typeorm';
import { config } from '../config';

export const dataSource = new DataSource({
  type: '{{DB_TYPE}}',
  host: config.DB_HOST,
  port: config.DB_PORT,
  username: config.DB_USER,
  password: config.DB_PASSWORD,
  database: config.DB_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  migrationsRun: false,
});

export default dataSource; // for the TypeORM CLI
```

The application calls `dataSource.initialize()` once at startup and passes `dataSource` (or repositories from it) to the services that need them.
