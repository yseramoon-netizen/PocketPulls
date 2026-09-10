const MONEY_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("en-GB");
const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

export function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toWholeNumber(value: unknown): number {
  return Math.max(0, Math.floor(toNumber(value)));
}

export function formatMoney(value: number): string {
  return MONEY_FORMATTER.format(Math.max(0, value));
}

export function formatMarketValue(
  value: number | null | undefined,
): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return "Price pending";
  }

  return formatMoney(value);
}

export function formatWholeNumber(value: number): string {
  return WHOLE_NUMBER_FORMATTER.format(
    Math.max(0, Math.floor(value)),
  );
}

export function formatDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return DATE_FORMATTER.format(date);
}

export function formatDateTime(
  value: string | null | undefined,
): string {
  if (!value) {
    return "Not yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return DATE_TIME_FORMATTER.format(date);
}

export function normaliseStringArray(value: unknown): string[] {
  let source = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(source)) {
    return [];
  }

  return Array.from(
    new Set(
      source
        .filter(
          (item): item is string =>
            typeof item === "string" &&
            item.trim().length > 0,
        )
        .map((item) => item.trim()),
    ),
  ).sort((first, second) => NATURAL_COLLATOR.compare(first, second));
}

export function clamp(
  value: number,
  minimum: number,
  maximum: number,
): number {
  return Math.min(maximum, Math.max(minimum, value));
}
