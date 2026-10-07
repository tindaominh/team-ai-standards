// Writes config/env.schema.json from the zod env schema (zod v4).
// Run from the repository root: npm run docs:env-schema
//   package.json: "docs:env-schema": "<ts-runner> scripts/export-env-schema.ts"
//   (<ts-runner> is the TypeScript runner the repository already uses, e.g. ts-node)
// The output records the SHA-256 of the source file so that
// scripts/generate-docs.mjs can detect a stale export.
// Keep the whole env schema in SOURCE (one file), otherwise the hash misses changes.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { z } from 'zod';
import { envSchema } from '../src/config/env.schema';

const SOURCE = 'src/config/env.schema.ts';
const OUTPUT = 'config/env.schema.json';

const sourceHash = createHash('sha256')
  .update(readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n'))
  .digest('hex');

// io: 'input' describes what must be present in the environment, so variables
// with a default are not listed as required.
const schema = {
  ...z.toJSONSchema(envSchema, { io: 'input' }),
  'x-source': SOURCE,
  'x-source-sha256': sourceHash,
};

mkdirSync('config', { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`wrote ${OUTPUT}`);
