import pool from "./db/pool.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "./homeassistant/homeAssistantWebhook.js";

export async function getSearchUrl() {
  
let result;

try {
     result = await pool.query(
      "SELECT value FROM piratebay_movie_settings WHERE key = $1",
      ["search_url"]
    );
} catch (error) {
  console.error('getSearchUrl ',error)
          await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );

  process.exit(1);
  }

  if (result.rows.length === 0) {
    throw new Error("Pirate Bay movie search URL not found in DB");
  }

  return result.rows[0].value;
}

export const getBaseUrl = getSearchUrl;
