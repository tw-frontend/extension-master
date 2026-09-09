const TEHRAN_TIME_ZONE = "Asia/Tehran";
const DAY_MS = 24 * 60 * 60 * 1000;

const gregorianFormatter = new Intl.DateTimeFormat("en-CA", {
  calendar: "gregory",
  numberingSystem: "latn",
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const persianFormatter = new Intl.DateTimeFormat(
  "en-US-u-ca-persian-nu-latn",
  {
    timeZone: TEHRAN_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
  },
);

function parts(formatter, date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
}

function isoDateInTehran(date) {
  const value = parts(gregorianFormatter, date);
  return `${value.year}-${value.month}-${value.day}`;
}

export function getJalaliMonthStatus(now = new Date()) {
  const currentPersian = parts(persianFormatter, now);
  const day = Number(currentPersian.day);
  const todayIso = isoDateInTehran(now);
  const [year, month, date] = todayIso.split("-").map(Number);
  const today = new Date(Date.UTC(year, month - 1, date, 12));
  const start = new Date(today.getTime() - (day - 1) * DAY_MS);

  let cursor = new Date(start.getTime() + 28 * DAY_MS);
  while (Number(parts(persianFormatter, cursor).day) !== 1) {
    cursor = new Date(cursor.getTime() + DAY_MS);
  }

  const daysInMonth = Math.round((cursor.getTime() - start.getTime()) / DAY_MS);
  return {
    label: `${currentPersian.month} ${currentPersian.year}`,
    startDate: isoDateInTehran(start),
    endDate: todayIso,
    day,
    daysInMonth,
    daysRemaining: daysInMonth - day,
    progressPercent: Math.round((day / daysInMonth) * 100),
  };
}

export function summarizeModels(spendByModel = [], requestsByModel = []) {
  const models = new Map();
  for (const { model, total } of spendByModel) {
    models.set(model, { model, spend: total, requests: 0 });
  }
  for (const { model, count } of requestsByModel) {
    const current = models.get(model) ?? { model, spend: 0, requests: 0 };
    current.requests = count;
    models.set(model, current);
  }
  return [...models.values()].sort(
    (a, b) => b.spend - a.spend || b.requests - a.requests,
  );
}

export function buildDashboardSummary({ budget, spend, requests }) {
  const errors = [budget, spend, requests]
    .filter((resource) => !resource?.ok)
    .map(
      (resource) =>
        resource?.error?.message ?? "Part of the dashboard is unavailable.",
    );
  const spendData = spend?.ok ? spend.data : null;
  const requestData = requests?.ok ? requests.data : null;

  return {
    remainingBudget: budget?.ok ? budget.data.remainingBudget : null,
    totalSpend: spendData?.totalSpend ?? null,
    averageDailySpend: spendData?.averageDailySpend ?? null,
    totalRequests: requestData?.totalRequests ?? null,
    averageSpendPerRequest: requestData?.averageSpendPerRequest ?? null,
    optimizationRank: requestData?.rankByAverageSpend ?? null,
    overallRank: requestData?.userRank ?? null,
    totalUsers: requestData?.totalUsers ?? null,
    models: summarizeModels(
      spendData?.spendByModel,
      requestData?.requestsByModel,
    ),
    errors,
  };
}
