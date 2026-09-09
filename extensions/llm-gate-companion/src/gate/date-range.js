import { failure, success } from "./result.js";

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isGregorianIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export function validateDateRange({ startDate, endDate } = {}) {
  if (!isGregorianIsoDate(startDate) || !isGregorianIsoDate(endDate)) {
    return failure(
      "INVALID_DATE_RANGE",
      "Use valid YYYY-MM-DD dates.",
      false,
    );
  }

  if (startDate > endDate) {
    return failure(
      "INVALID_DATE_RANGE",
      "Start date must be on or before end date.",
      false,
    );
  }

  return success({ startDate, endDate });
}
