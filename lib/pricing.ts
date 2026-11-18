// Editable INR catalog amounts; no foreign-exchange conversion is involved.
export const BASE_PRINT_PRICE_INR = 5000
export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}
