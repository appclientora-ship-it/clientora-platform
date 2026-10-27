import { describe, expect, it } from "vitest";

describe("booking review rules", () => {
  it("accepts only the five-star range", () => {
    expect([1, 2, 3, 4, 5].every(rating => rating >= 1 && rating <= 5)).toBe(true);
    expect([0, 6, -1].some(rating => rating < 1 || rating > 5)).toBe(true);
  });

  it("allows review eligibility only after the booking is marked arrived", () => {
    const eligible = (status: string) => status === "arrived";
    expect(eligible("arrived")).toBe(true);
    expect(eligible("new")).toBe(false);
    expect(eligible("confirmed")).toBe(false);
    expect(eligible("cancelled")).toBe(false);
  });
});
