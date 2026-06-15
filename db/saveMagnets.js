
import { delay } from "../delay.js";
import pool from "./pool.js";

import { triggerHomeAssistantWebhookWhenErrorOccurs } from "../homeassistant/homeAssistantWebhook.js";
import { retry } from "../homeassistant/retryWrapper.js";

function detectMediaType(title = "") {
  const tvPatterns = [
    /S\d{1,2}E\d{1,2}/i,     // S01E01
    /Season\s+\d+/i,         // Season 1
    /\bE\d{1,3}\b/i,         // E01
    /\d+x\d+/i               // 1x01
  ];

  return tvPatterns.some(pattern => pattern.test(title))
    ? "tv"
    : "movie";
}
export async function saveMagnets(magnetLinks) {
  const torrents = magnetLinks.map((item) =>
    typeof item === "string" ? { magnet: item } : item
  );

  for (const torrent of torrents) {
    try {
      await pool.query(
        `INSERT INTO piratebay_movie_magnets
(title, magnet, source_url, size, seeders, leechers, media_type)
VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (magnet) DO NOTHING`,
       [
  torrent.title || null,
  torrent.magnet,
  torrent.sourceUrl || null,
  torrent.size || null,
  Number.isInteger(torrent.seeders) ? torrent.seeders : null,
  Number.isInteger(torrent.leechers) ? torrent.leechers : null,
  detectMediaType(torrent.title)
]
      );
    } catch (error) {
        console.error("DB saveMagnets:", error.message);
            await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );

    }

    await delay(300,true);
  }
}
