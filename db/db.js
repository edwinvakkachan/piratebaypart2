import pkg from "pg";
const { Pool } = pkg;
// import 'dotenv/config';
import { delay } from "../delay.js";

import pool from "../db/pool.js";
import { triggerHomeAssistantWebhookWhenErrorOccurs } from "../homeassistant/homeAssistantWebhook.js";
import { retry } from "../homeassistant/retryWrapper.js";

export async function initDB() {
try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS piratebay_movie_magnets (
        id SERIAL PRIMARY KEY,
        title TEXT,
        magnet TEXT UNIQUE NOT NULL,
        source_url TEXT,
        size TEXT,
        seeders INTEGER,
        leechers INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  
      await pool.query(`
      CREATE TABLE IF NOT EXISTS piratebay_movie_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  
  
     await pool.query(`
      INSERT INTO piratebay_movie_settings (key, value)
      VALUES ('search_url', 'https://thepiratebay.org/search.php?q=category:200')
      ON CONFLICT (key) DO NOTHING
    `);
  
      await pool.query(`
    CREATE TABLE IF NOT EXISTS piratebay_movie_processed_links (
      id SERIAL PRIMARY KEY,
      href TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
} catch (error) {
  console.error("DB insert error:", error);
          await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );

  process.exit(1);
}

  return pool;
}


export async function insertLinkIfNew(href) {
  try {
    const result = await pool.query(
      `INSERT INTO piratebay_movie_processed_links (href)
       VALUES ($1)
       ON CONFLICT (href) DO NOTHING
       RETURNING id`,
      [href]
    );
    await delay(300,true);
    return result.rowCount === 1; // true if new
  } catch (err) {
    console.error("DB insertLinkIfNew:", err);
            await retry(
    triggerHomeAssistantWebhookWhenErrorOccurs,
    { status: "error" },
    "homeassistant-error",
    5
  );


  process.exit(1);
  }
}
