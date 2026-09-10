export function displayMetric(
  value: string | number,
  format: "number" | "currency" | "percent" | "text",
  currency = "USD",
) {
  if (typeof value === "string" || format === "text") return String(value);
  if (format === "percent")
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 0,
    }).format(value);
  if (format === "currency") {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency} ${value.toLocaleString()}`;
    }
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
