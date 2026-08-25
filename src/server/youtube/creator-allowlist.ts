export type CreatorAllowlistEntry = {
  youtubeChannelId: string;
  handle: string;
  expectedTitle: string;
  channelUrl: string;
};

/**
 * WU-12 P0 creator allowlist.
 *
 * Only channels agreed by the team belong here. YouTube metadata remains the
 * source of truth for the displayed title and thumbnail.
 */
export const creatorAllowlist = [
  {
    youtubeChannelId: "UCl23-Cci_SMqyGXE1T_LYUg",
    handle: "@sungsikyung",
    expectedTitle: "성시경 SUNG SI KYUNG",
    channelUrl: "https://www.youtube.com/@sungsikyung",
  },
  {
    youtubeChannelId: "UC-x55HF1-IilhxZOzwJm7JA",
    handle: "@kim3meals",
    expectedTitle: "김사원세끼",
    channelUrl: "https://www.youtube.com/@kim3meals",
  },
  {
    youtubeChannelId: "UCoLPofyAZuuq6v4EWrWRguw",
    handle: "@rawfisheater",
    expectedTitle: "회사랑RawFishEater",
    channelUrl: "https://www.youtube.com/@rawfisheater",
  },
  {
    youtubeChannelId: "UCkBoDzncl64EZ-Ggh4g5pCw",
    handle: "@huntaetv",
    expectedTitle: "섬마을훈태TV",
    channelUrl: "https://www.youtube.com/@huntaetv",
  },
  {
    youtubeChannelId: "UCObJpvG3_f0P3EuLJCjzT5g",
    handle: "@bigfacetv",
    expectedTitle: "빅페이스 BIGFACE",
    channelUrl: "https://www.youtube.com/@bigfacetv",
  },
] as const satisfies readonly CreatorAllowlistEntry[];
