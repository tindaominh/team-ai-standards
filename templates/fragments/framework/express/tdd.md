# Express: building the class under test

- Services: construct them directly with mocked dependencies; test business rules there.
- Routes: build the app with `createApp({ services: mocks })` and call it with `supertest`; assert status, body and that validation rejects bad input.
- Integration: build the app with real services against the local {{DB_LABEL}} container and synthetic fixtures.
