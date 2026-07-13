import { describe, expect, it } from "vitest";
import { loginSchema } from "./dto/login.dto";
import { registerSchema } from "./dto/register.dto";

describe("auth DTOs", () => {
  it("requires full_name and normalizes registration email", () => {
    const result = registerSchema.safeParse({
      email: "  Student@Test.com ",
      password: "secure-password",
      full_name: "  Ivan Ivanov  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("student@test.com");
      expect(result.data.full_name).toBe("Ivan Ivanov");
    }
  });

  it("rejects registration without full_name", () => {
    const result = registerSchema.safeParse({
      email: "student@test.com",
      password: "secure-password",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes login email", () => {
    const result = loginSchema.safeParse({
      email: "  Student@Test.com ",
      password: "password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("student@test.com");
    }
  });
});
