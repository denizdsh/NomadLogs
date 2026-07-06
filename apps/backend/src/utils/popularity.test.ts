import { describe, it, expect } from "vitest";
import { calculatePopularity } from "./popularity.js";

describe("calculatePopularity", () => {
  it("should calculate correct popularity score based on counts and multipliers", () => {
    const stats = {
      viewCount: 10,
      fullReadCount: 5,
      likeCount: 2,
      saveCount: 1,
      commentCount: 0,
    };
    
    // (10 * 1) + (5 * 2) + (2 * 6) + (1 * 12) + (0 * 24) = 10 + 10 + 12 + 12 + 0 = 44
    const score = calculatePopularity(stats);
    expect(score).toBe(44);
  });

  it("should return 0 when all counts are 0", () => {
    const stats = {
      viewCount: 0,
      fullReadCount: 0,
      likeCount: 0,
      saveCount: 0,
      commentCount: 0,
    };
    expect(calculatePopularity(stats)).toBe(0);
  });
});
