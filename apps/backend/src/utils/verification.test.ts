import { describe, it, expect } from "vitest";
import { determineVerificationStatus } from "./verification.js";
import { UserRole, VerificationStatus, Visibility } from "@nomadlogs/db";

describe("determineVerificationStatus", () => {
  it("should return VERIFIED when author is VERIFIED and moving from PRIVATE to PUBLIC", () => {
    const status = determineVerificationStatus(
      VerificationStatus.UNVERIFIED,
      Visibility.PRIVATE,
      Visibility.PUBLIC,
      UserRole.VERIFIED
    );
    expect(status).toBe(VerificationStatus.VERIFIED);
  });

  it("should return PENDING when author is UNVERIFIED and moving from PRIVATE to PUBLIC", () => {
    const status = determineVerificationStatus(
      VerificationStatus.UNVERIFIED,
      Visibility.PRIVATE,
      Visibility.PUBLIC,
      UserRole.UNVERIFIED
    );
    expect(status).toBe(VerificationStatus.PENDING);
  });

  it("should keep current status if visibility was already PUBLIC", () => {
    const status = determineVerificationStatus(
      VerificationStatus.VERIFIED,
      Visibility.PUBLIC,
      Visibility.UNLISTED,
      UserRole.UNVERIFIED
    );
    expect(status).toBe(VerificationStatus.VERIFIED);
  });
});
