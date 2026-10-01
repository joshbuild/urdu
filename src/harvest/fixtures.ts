// f17: Harvest tab fixtures for the render tests and the headless layout check.

import type { HarvestDetail, HarvestOverview, SourceDetail } from "../../shared/api";

const AT = "2026-09-30T18:00:00.000Z";

export const OVERVIEW: HarvestOverview = {
  intake: { queued: 24, new: 6, batch_size: 10 },
  sources: [
    {
      id: "s1",
      name: "Saadat Hasan Manto, Toba Tek Singh",
      url: "https://www.rekhta.org/stories/toba-tek-singh",
      notes: null,
      created_at: AT,
      updated_at: AT,
      status: "to_harvest",
      harvest_count: 0,
      latest: null,
    },
    {
      id: "s2",
      name: "BBC Urdu: monsoon report",
      url: "https://www.bbc.com/urdu/articles/c1",
      notes: null,
      created_at: AT,
      updated_at: AT,
      status: "harvested",
      harvest_count: 2,
      latest: { filter: "CEFR A2+", created_at: AT },
    },
    {
      id: "s3",
      name: "ChatGPT chat",
      url: null,
      notes: null,
      created_at: AT,
      updated_at: AT,
      status: "harvested",
      harvest_count: 1,
      latest: { filter: null, created_at: AT },
    },
  ],
};

export const SOURCE: SourceDetail = {
  source: { ...(OVERVIEW.sources[1] as SourceDetail["source"]), notes: "Long read, two pastes." },
  words: 62,
  harvests: [
    {
      id: "h2",
      source_id: "s2",
      filter: "CEFR B1+",
      created_at: AT,
      total: 0,
      queued: 0,
      started: 0,
    },
    {
      id: "h1",
      source_id: "s2",
      filter: "CEFR A2+",
      created_at: AT,
      total: 62,
      queued: 40,
      started: 12,
    },
  ],
};

export const HARVEST: HarvestDetail = {
  source: SOURCE.source,
  harvest: SOURCE.harvests[1] as HarvestDetail["harvest"],
};
