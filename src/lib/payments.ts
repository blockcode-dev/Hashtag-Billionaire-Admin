/** @format */

// How the customer paid, as the backend stores it (payment_mode, also an order's payment_method).
// Square sets every mode except PAYPAL.
const PAYMENT_MODES: Record<string, string> = {
  CARD: "Card",
  CREDIT_CARD: "Credit card",
  DEBIT_CARD: "Debit card",
  GOOGLE_PAY: "Google Pay",
  APPLE_PAY: "Apple Pay",
  CASH_APP: "Cash App",
  AFTERPAY: "Afterpay",
  ACH: "ACH",
  BANK_ACCOUNT: "Bank account",
  UNKNOWN: "Unknown",
  PAYPAL: "PayPal",
};

export const paymentModeLabel = (mode?: string | null): string => {
  if (!mode) return "--";
  const key = mode.toUpperCase();
  return PAYMENT_MODES[key] ?? key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, " ");
};

// Where a refund is made by hand. Refunds aren't automatic.
export const refundPlace = (mode?: string | null): string => {
  const key = mode?.toUpperCase();
  if (key === "PAYPAL") return "PayPal";
  if (key && key !== "UNKNOWN" && key in PAYMENT_MODES) return "Square";
  return "Square or PayPal";
};
