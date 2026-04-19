import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getServerEnv,
  getTestDatabaseUrl,
  resetServerEnvForTests
} from "@/config/env.server";

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  delete process.env.TEST_DATABASE_URL;
  resetServerEnvForTests();
}

describe("server env", () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it("requires a runtime database url", () => {
    expect(() => getServerEnv()).toThrow(/DATABASE_URL/i);
  });

  it("returns runtime, direct, and test database urls when configured", () => {
    process.env.DATABASE_URL = "postgresql://runtime-user:pw@db.example.com:5432/runtime";
    process.env.DIRECT_URL = "postgresql://direct-user:pw@db.example.com:5432/direct";
    process.env.TEST_DATABASE_URL = "postgresql://test-user:pw@db.example.com:5432/test";
    resetServerEnvForTests();

    expect(getServerEnv()).toMatchObject({
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL
    });
    expect(getTestDatabaseUrl()).toBe(process.env.TEST_DATABASE_URL);
  });

  it("rejects using the runtime database for tests", () => {
    process.env.DATABASE_URL = "postgresql://same-user:pw@db.example.com:5432/shared";
    process.env.DIRECT_URL = "postgresql://direct-user:pw@db.example.com:5432/direct";
    process.env.TEST_DATABASE_URL = process.env.DATABASE_URL;
    resetServerEnvForTests();

    expect(() => getTestDatabaseUrl()).toThrow(/TEST_DATABASE_URL/i);
  });
});
