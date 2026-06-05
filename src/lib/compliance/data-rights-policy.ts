export const DATA_DELETION_GRACE_DAYS = 7;
export const DATA_DELETION_RESPONSE_DAYS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function getScheduledDeletionAt(requestedAt: Date = new Date()) {
  return addDays(requestedAt, DATA_DELETION_GRACE_DAYS);
}

export function getVerificationDueAt(requestedAt: Date = new Date()) {
  return addDays(requestedAt, DATA_DELETION_RESPONSE_DAYS);
}

export function buildDeletedUserEmail(profileId: string) {
  return `deleted+${profileId.replace(/-/g, "")}@deleted.popsdrops.local`;
}
