# Node.js without a web framework: building the class under test

Construct the class under test directly and pass mocks for its constructor dependencies (repositories, pools, clients). Test message handlers by calling them with synthetic messages, including invalid and duplicate ones.

Integration test: initialise the real data access against the local {{DB_LABEL}} container (environment from a test `.env` with fake values), run migrations, use synthetic fixtures, clean the database per test file, and close connections after the suite.
