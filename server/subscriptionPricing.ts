export type SubscriptionPlan = {
  id: "solo" | "starter" | "basic" | "growth" | "business" | "pro" | "enterprise";
  name: string;
  minEmployees: number;
  maxEmployees: number;
  monthlyPriceUsd: number;
};

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  { id: "solo", name: "Solo", minEmployees: 1, maxEmployees: 1, monthlyPriceUsd: 5 },
  { id: "starter", name: "Starter", minEmployees: 2, maxEmployees: 4, monthlyPriceUsd: 10 },
  { id: "basic", name: "Basic", minEmployees: 5, maxEmployees: 9, monthlyPriceUsd: 17 },
  { id: "growth", name: "Growth", minEmployees: 10, maxEmployees: 15, monthlyPriceUsd: 25 },
  { id: "business", name: "Business", minEmployees: 16, maxEmployees: 22, monthlyPriceUsd: 32 },
  { id: "pro", name: "Pro", minEmployees: 23, maxEmployees: 25, monthlyPriceUsd: 35 },
  { id: "enterprise", name: "Enterprise", minEmployees: 26, maxEmployees: 35, monthlyPriceUsd: 50 },
] as const;

export const SUBSCRIPTION_DISCOUNTS = {
  1: 0,
  3: 0.1,
  9: 0.15,
  12: 0.25,
} as const;

export const GRACE_PERIOD_DAYS = 21;
export type SupportedBillingMonths = keyof typeof SUBSCRIPTION_DISCOUNTS;

export function getPlanForEmployeeCount(employeeCount: number): SubscriptionPlan | null {
  if (!Number.isInteger(employeeCount) || employeeCount < 1) return null;
  return SUBSCRIPTION_PLANS.find(
    (plan) => employeeCount >= plan.minEmployees && employeeCount <= plan.maxEmployees,
  ) ?? null;
}

export type SubscriptionQuote = {
  plan: SubscriptionPlan;
  employeeCount: number;
  months: SupportedBillingMonths;
  monthlyPriceUsd: number;
  subtotalCents: number;
  discountRate: number;
  discountCents: number;
  totalCents: number;
};

export function calculateSubscriptionQuote(
  employeeCount: number,
  months: number,
): SubscriptionQuote {
  const plan = getPlanForEmployeeCount(employeeCount);
  if (!plan) {
    throw new RangeError(
      employeeCount > 35
        ? "Enterprise plans above 35 employees require a custom quote."
        : "Employee count must be an integer between 1 and 35.",
    );
  }

  if (!(months in SUBSCRIPTION_DISCOUNTS)) {
    throw new RangeError("Billing period must be 1, 3, 9, or 12 months.");
  }

  const supportedMonths = months as SupportedBillingMonths;
  const subtotalCents = plan.monthlyPriceUsd * 100 * supportedMonths;
  const discountRate = SUBSCRIPTION_DISCOUNTS[supportedMonths];
  const discountCents = Math.round(subtotalCents * discountRate);

  return {
    plan,
    employeeCount,
    months: supportedMonths,
    monthlyPriceUsd: plan.monthlyPriceUsd,
    subtotalCents,
    discountRate,
    discountCents,
    totalCents: subtotalCents - discountCents,
  };
}
