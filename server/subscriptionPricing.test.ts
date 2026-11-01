import { describe, expect, it } from "vitest";
import {
  calculateSubscriptionQuote,
  getPlanForEmployeeCount,
  GRACE_PERIOD_DAYS,
  SUBSCRIPTION_PLANS,
} from "./subscriptionPricing";

describe("subscription pricing catalog", () => {
  it("contains the seven approved plans and prices", () => {
    expect(SUBSCRIPTION_PLANS.map(({ id, minEmployees, maxEmployees, monthlyPriceUsd }) => [
      id, minEmployees, maxEmployees, monthlyPriceUsd,
    ])).toEqual([
      ["solo", 1, 1, 5],
      ["starter", 2, 4, 10],
      ["basic", 5, 9, 17],
      ["growth", 10, 15, 25],
      ["business", 16, 22, 32],
      ["pro", 23, 25, 35],
      ["enterprise", 26, 35, 50],
    ]);
  });

  it.each([
    [1, "solo"], [2, "starter"], [4, "starter"], [5, "basic"],
    [9, "basic"], [10, "growth"], [15, "growth"], [16, "business"],
    [22, "business"], [23, "pro"], [25, "pro"], [26, "enterprise"],
    [35, "enterprise"],
  ])("assigns %i active employees to %s", (count, planId) => {
    expect(getPlanForEmployeeCount(count)?.id).toBe(planId);
  });

  it.each([0, -1, 36, 1.5, Number.NaN])("does not assign an invalid or unsupported count: %s", (count) => {
    expect(getPlanForEmployeeCount(count)).toBeNull();
  });

  it("calculates the approved discounts in integer cents", () => {
    expect(calculateSubscriptionQuote(1, 1).totalCents).toBe(500);
    expect(calculateSubscriptionQuote(1, 3).totalCents).toBe(1350);
    expect(calculateSubscriptionQuote(1, 9).totalCents).toBe(3825);
    expect(calculateSubscriptionQuote(1, 12).totalCents).toBe(4500);
    expect(calculateSubscriptionQuote(5, 12).totalCents).toBe(15300);
  });

  it("rejects unsupported billing periods", () => {
    expect(() => calculateSubscriptionQuote(1, 6)).toThrow(RangeError);
  });

  it("requires a custom quote above 35 employees", () => {
    expect(() => calculateSubscriptionQuote(36, 1)).toThrow(/custom quote/i);
  });

  it("keeps the agreed 21-day grace period as a single shared constant", () => {
    expect(GRACE_PERIOD_DAYS).toBe(21);
  });
});
