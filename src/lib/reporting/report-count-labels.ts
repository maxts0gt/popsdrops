export function formatReportChannelCount(count: number): string {
  return `${count} ${count === 1 ? "channel" : "channels"}`;
}

export function formatReportReadCount(count: number): string {
  return `${count} ${count === 1 ? "read" : "reads"}`;
}
