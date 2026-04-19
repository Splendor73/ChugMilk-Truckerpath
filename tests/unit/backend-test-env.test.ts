import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { configureBackendTestEnv } from "../helpers/backend";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TEST_DATABASE_URL;
}

describe("backend test env", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it("points prisma at the dedicated test database", () => {
    process.env.DATABASE_URL = "postgresql://runtime-user:pw@db.example.com:5432/runtime";
    process.env.TEST_DATABASE_URL = "postgresql://test-user:pw@db.example.com:5432/test";

    configureBackendTestEnv();

    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
    expect(process.env.DIRECT_URL).toBe(process.env.TEST_DATABASE_URL);
    expect(process.env.USE_SYNTHETIC_NAVPRO).toBe("true");
    expect(process.env.USE_NAVPRO_MOCK).toBe("true");
  });

  it("fails fast when no dedicated test database is configured", () => {
    process.env.DATABASE_URL = "postgresql://runtime-user:pw@db.example.com:5432/runtime";

    expect(() => configureBackendTestEnv()).toThrow(/TEST_DATABASE_URL/i);
  });

  it("allows a shared test database only when explicitly opted in", () => {
    process.env.DATABASE_URL = "postgresql://shared-user:pw@db.example.com:5432/shared";
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    process.env.ALLOW_SHARED_TEST_DATABASE = "true";

    expect(() => configureBackendTestEnv()).not.toThrow();
    expect(process.env.DATABASE_URL).toBe(process.env.TEST_DATABASE_URL);
  });
});
