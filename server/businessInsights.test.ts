import { describe, expect, it } from "vitest";
import { buildBusinessInsights, type BusinessInsightInput } from "../client/src/lib/businessInsights";

function makeInput(overrides: Partial<BusinessInsightInput> = {}): BusinessInsightInput {
  return {
    bookings: 10,
    completed: 6,
    cancelled: 2,
    revenue: 1000,
    paidRevenue: 800,
    expenseTotal: 300,
    employees: [{ id: 1, name: "Mona", revenue: 600, noShow: 1 }],
    ...overrides,
  };
}

describe("buildBusinessInsights", () => {
  it("calculates no-show rate only from non-canceled bookings", () => {
    const result = buildBusinessInsights(makeInput({
      bookings: 10,
      cancelled: 5,
      employees: [{ id: 1, name: "Mona", revenue: 600, noShow: 1 }],
    }));

    expect(result.noShowCount).toBe(1);
    expect(result.noShowRate).toBe(1 / 5);
    expect(result.recommendations.find(item => item.title === "معدل عدم الحضور يحتاج متابعة")?.detail)
      .toContain("1 من 5 حجزاً غير ملغى");
  });

  it("returns a zero no-show rate when every booking was canceled", () => {
    const result = buildBusinessInsights(makeInput({
      bookings: 4,
      cancelled: 4,
      employees: [{ id: 1, name: "Mona", revenue: 0, noShow: 0 }],
    }));

    expect(result.noShowRate).toBe(0);
    expect(result.recommendations.some(item => item.title === "معدل عدم الحضور يحتاج متابعة")).toBe(false);
  });

  it("keeps an empty period honest without inventing activity", () => {
    const result = buildBusinessInsights(makeInput({
      bookings: 0,
      completed: 0,
      cancelled: 0,
      revenue: 0,
      paidRevenue: 0,
      expenseTotal: 0,
      employees: [],
    }));

    expect(result.noShowCount).toBe(0);
    expect(result.noShowRate).toBe(0);
    expect(result.unpaid).toBe(0);
    expect(result.net).toBe(0);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].title).toBe("ابدأ بجمع بيانات التشغيل");
  });

  it("calculates unpaid revenue and operational net from recorded values", () => {
    const result = buildBusinessInsights(makeInput({ revenue: 1000, paidRevenue: 750, expenseTotal: 400 }));

    expect(result.unpaid).toBe(250);
    expect(result.net).toBe(600);
  });

  it("does not report negative unpaid revenue when paid revenue exceeds revenue", () => {
    const result = buildBusinessInsights(makeInput({ revenue: 500, paidRevenue: 650 }));

    expect(result.unpaid).toBe(0);
  });
});
