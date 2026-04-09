export const MOBILE_EDITORIAL_OVERRIDES: Partial<
  Record<string, Record<string, string>>
> = {
  el: {
    "preferences.languageDetail":
      "Επιλέξτε τη γλώσσα της εφαρμογής. Μπορείτε να επιστρέψετε στα Αγγλικά οποιαδήποτε στιγμή.",
  },
  hi: {
    "preferences.languageDetail":
      "इस डिवाइस के लिए ऐप की भाषा चुनें। आप कभी भी वापस अंग्रेज़ी पर जा सकते हैं।",
    "home.subtitle": "यह आपका सारांश है",
  },
  kk: {
    "preferences.languageDetail":
      "Осы құрылғы үшін интерфейс тілін таңдаңыз. Ағылшын тіліне кез келген уақытта қайта ауыса аласыз.",
  },
  tl: {
    "preferences.languageDetail":
      "Piliin ang wika ng app para sa device na ito. Maaari kang bumalik sa Ingles anumang oras.",
    "tab.campaigns": "Mga Kampanya",
    "home.subtitle": "Narito ang iyong buod",
    "home.newMatches": "Mga Kampanya Para sa Iyo",
    "home.emptyDetail":
      "Kumpletuhin ang iyong profile at itutugma ka namin sa mga kampanya mula sa mga global na brand",
    "home.exploreCampaigns": "Tuklasin ang mga kampanya",
    "campaignDetail.title": "Kampanya",
    "campaignDetail.apply": "Mag-apply sa kampanya",
    "discover.search": "Maghanap ng mga kampanya…",
    "discover.empty": "Walang kampanyang tumutugma sa iyong mga filter",
    "campaigns.title": "Aking mga Kampanya",
    "campaigns.empty": "Wala pang aktibong kampanya",
    "campaigns.emptyDetail":
      "Mag-browse ng mga oportunidad para mahanap ang iyong unang kampanya",
    "campaigns.browse": "Mag-browse ng mga kampanya",
    "profile.preferencesDetail": "Hitsura at wika",
  },
  uz: {
    "preferences.languageDetail":
      "Ushbu qurilma uchun interfeys tilini tanlang. Ingliz tiliga istalgan payt qayta o'tishingiz mumkin.",
  },
  zh: {
    "preferences.languageDetail":
      "选择此设备的界面语言。你可以随时切换回英语。",
    "discover.search": "搜索营销活动…",
  },
};

export function applyMobileEditorialOverrides(
  bundle: Record<string, string>,
  overrides?: Record<string, string>,
): Record<string, string> {
  if (!overrides) {
    return bundle;
  }

  return {
    ...bundle,
    ...overrides,
  };
}
