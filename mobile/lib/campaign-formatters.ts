export function formatCampaignBudget(input: {
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string;
  locale?: string;
}): string | null {
  const { budgetMin, budgetMax, budgetCurrency, locale = "en" } = input;

  if (budgetMin == null && budgetMax == null) {
    return null;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: budgetCurrency,
    maximumFractionDigits: 0,
  });

  if (budgetMin != null && budgetMax != null) {
    if (budgetMin === budgetMax) {
      return formatter.format(budgetMin);
    }

    return `${formatter.format(budgetMin)}-${formatter.format(budgetMax)}`;
  }

  if (budgetMin != null) {
    return formatter.format(budgetMin);
  }

  return formatter.format(budgetMax ?? 0);
}

export function formatCampaignDate(
  date: string | null,
  locale = "en",
): string | null {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}
