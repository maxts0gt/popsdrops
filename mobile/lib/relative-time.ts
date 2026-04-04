type RelativeTimeOptions = {
  locale?: string;
  now?: number;
};

export function formatRelativeTime(
  dateStr: string,
  options: RelativeTimeOptions = {},
): string {
  const { locale, now = Date.now() } = options;
  const date = new Date(dateStr);
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  const relative = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
  });

  if (minutes < 1) {
    return relative.format(0, "second");
  }

  if (minutes < 60) {
    return relative.format(-minutes, "minute");
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return relative.format(-hours, "hour");
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return relative.format(-days, "day");
  }

  return new Intl.DateTimeFormat(locale).format(date);
}
