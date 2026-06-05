export type CampaignCreatorInviteCapacityContact = {
  normalizedContact: string | null | undefined;
  status: string | null | undefined;
};

export type CampaignCreatorInviteSendCapacityInput = {
  acceptedCreatorCount: number | null | undefined;
  capacity: number | null | undefined;
  inviteNormalizedContact: string | null | undefined;
  savedInvites: CampaignCreatorInviteCapacityContact[];
};

export type CampaignCreatorInviteSendCapacityState = {
  acceptedCreatorCount: number;
  capacity: number;
  reservedInviteCount: number;
  totalReservedCreatorCount: number;
  remainingCreatorSlots: number;
  isOverCapacity: boolean;
};

export const campaignCreatorInviteSendCapacityMessage =
  "This invite would exceed the paid creator capacity. Increase campaign capacity before sending more creator invites.";

function normalizePositiveInteger(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(Number(value)));
}

function normalizeContact(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null;
}

function isReservedInviteStatus(status: string | null | undefined) {
  return status !== "sent";
}

export function getCampaignCreatorInviteSendCapacityState({
  acceptedCreatorCount,
  capacity,
  inviteNormalizedContact,
  savedInvites,
}: CampaignCreatorInviteSendCapacityInput): CampaignCreatorInviteSendCapacityState {
  const normalizedAcceptedCreatorCount = normalizePositiveInteger(
    acceptedCreatorCount,
  );
  const normalizedCapacity = Math.max(1, normalizePositiveInteger(capacity));
  const reservedContacts = new Set<string>();

  for (const invite of savedInvites) {
    if (!isReservedInviteStatus(invite.status)) continue;
    const normalizedContact = normalizeContact(invite.normalizedContact);
    if (normalizedContact) reservedContacts.add(normalizedContact);
  }

  const currentInviteContact = normalizeContact(inviteNormalizedContact);
  if (currentInviteContact) reservedContacts.add(currentInviteContact);

  const reservedInviteCount = reservedContacts.size;
  const totalReservedCreatorCount =
    normalizedAcceptedCreatorCount + reservedInviteCount;
  const remainingCreatorSlots = Math.max(
    0,
    normalizedCapacity - totalReservedCreatorCount,
  );

  return {
    acceptedCreatorCount: normalizedAcceptedCreatorCount,
    capacity: normalizedCapacity,
    reservedInviteCount,
    totalReservedCreatorCount,
    remainingCreatorSlots,
    isOverCapacity: totalReservedCreatorCount > normalizedCapacity,
  };
}

export function assertCampaignCreatorInviteSendCapacity(
  input: CampaignCreatorInviteSendCapacityInput,
) {
  const state = getCampaignCreatorInviteSendCapacityState(input);
  if (state.isOverCapacity) {
    throw new Error(campaignCreatorInviteSendCapacityMessage);
  }
  return state;
}
