const creatorInvitePlatforms = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
  "facebook",
] as const;

type CreatorInvitePlatform = (typeof creatorInvitePlatforms)[number];

type CreatorSocialAccount =
  | string
  | {
      handle?: unknown;
      url?: unknown;
    }
  | null
  | undefined;

export type CreatorInviteProfile = Partial<
  Record<CreatorInvitePlatform, CreatorSocialAccount>
>;

type CreatorInvite = {
  contact_type: "email" | "handle";
  normalized_contact: string;
};

function normalizeInviteContact(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function getSocialAccountCandidates(account: CreatorSocialAccount) {
  if (!account) return [];
  if (typeof account === "string") return [normalizeInviteContact(account)];

  return [account.handle, account.url]
    .map((value) => normalizeInviteContact(value))
    .filter(Boolean);
}

function socialAccountMatchesHandle(account: CreatorSocialAccount, handle: string) {
  const normalizedHandle = handle.replace(/^@/, "");
  if (!normalizedHandle) return false;

  return getSocialAccountCandidates(account).some((candidate) => {
    const withoutAt = candidate.replace(/^@/, "");
    return (
      candidate === handle ||
      candidate === normalizedHandle ||
      withoutAt === normalizedHandle ||
      candidate.includes(`/${normalizedHandle}`) ||
      candidate.includes(`/@${normalizedHandle}`) ||
      candidate.includes(`@${normalizedHandle}`)
    );
  });
}

export function creatorProfileMatchesInvite({
  creatorAccountProfile,
  invite,
  userEmail,
}: {
  creatorAccountProfile: CreatorInviteProfile | null | undefined;
  invite: CreatorInvite;
  userEmail: string | undefined;
}) {
  const normalizedContact = normalizeInviteContact(invite.normalized_contact);

  if (invite.contact_type === "email") {
    return normalizeInviteContact(userEmail) === normalizedContact;
  }

  return creatorInvitePlatforms.some((platform) =>
    socialAccountMatchesHandle(creatorAccountProfile?.[platform], normalizedContact),
  );
}
