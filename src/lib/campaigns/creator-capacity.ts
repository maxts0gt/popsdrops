export type CampaignCreatorCapacityInput = {
  maxCreators: number | null | undefined;
  acceptedCreatorCount: number | null | undefined;
};

export type CampaignCreatorCapacityState = {
  maxCreators: number;
  acceptedCreatorCount: number;
  remainingCreatorSlots: number;
  isFull: boolean;
};

export type CampaignCreatorBatchCapacityInput = CampaignCreatorCapacityInput & {
  requestedCreatorCount: number | null | undefined;
};

export type CampaignCreatorBatchCapacityState = CampaignCreatorCapacityState & {
  requestedCreatorCount: number;
};

export const campaignCreatorCapacityFullMessage =
  "This campaign has reached its paid creator capacity. Increase the campaign capacity before accepting more creators.";

function normalizePositiveInteger(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.floor(Number(value)));
}

export function getCampaignCreatorCapacityState({
  maxCreators,
  acceptedCreatorCount,
}: CampaignCreatorCapacityInput): CampaignCreatorCapacityState {
  const normalizedMaxCreators = Math.max(
    1,
    normalizePositiveInteger(maxCreators, 1),
  );
  const normalizedAcceptedCreatorCount = normalizePositiveInteger(
    acceptedCreatorCount,
    0,
  );
  const remainingCreatorSlots = Math.max(
    0,
    normalizedMaxCreators - normalizedAcceptedCreatorCount,
  );

  return {
    maxCreators: normalizedMaxCreators,
    acceptedCreatorCount: normalizedAcceptedCreatorCount,
    remainingCreatorSlots,
    isFull: remainingCreatorSlots === 0,
  };
}

export function assertCampaignCreatorCapacity(input: CampaignCreatorCapacityInput) {
  const state = getCampaignCreatorCapacityState(input);
  if (state.isFull) {
    throw new Error(campaignCreatorCapacityFullMessage);
  }
  return state;
}

export function assertCampaignCreatorBatchCapacity(
  input: CampaignCreatorBatchCapacityInput,
): CampaignCreatorBatchCapacityState {
  const state = getCampaignCreatorCapacityState(input);
  const requestedCreatorCount = normalizePositiveInteger(
    input.requestedCreatorCount,
    0,
  );

  if (requestedCreatorCount < 1) {
    throw new Error("Select at least one creator to accept.");
  }

  if (requestedCreatorCount > state.remainingCreatorSlots) {
    const slotNoun = state.remainingCreatorSlots === 1 ? "slot" : "slots";
    throw new Error(
      `This campaign has ${state.remainingCreatorSlots} paid creator ${slotNoun} open. Select fewer creators or increase capacity.`,
    );
  }

  return {
    ...state,
    requestedCreatorCount,
  };
}
