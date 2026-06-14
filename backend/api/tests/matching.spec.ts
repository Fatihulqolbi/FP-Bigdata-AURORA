import { describe, it, expect } from "vitest";
import { haversineDistance } from "../../src/modules/marketplace/listing.service.js";

describe("haversineDistance", () => {
  it("should return 0 for the same point", () => {
    expect(haversineDistance(-7.25, 112.76, -7.25, 112.76)).toBeCloseTo(0, 1);
  });

  it("should calculate distance between Surabaya points", () => {
    // Bratang to Benowo ~15 km
    const dist = haversineDistance(-7.295, 112.765, -7.234, 112.620);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(25);
  });

  it("should calculate long distances correctly", () => {
    const dist = haversineDistance(-6.2, 106.8, -7.25, 112.76);
    expect(dist).toBeGreaterThan(600);
    expect(dist).toBeLessThan(700);
  });
});
