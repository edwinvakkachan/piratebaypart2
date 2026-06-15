import axios from "axios";
import dotenv from "dotenv";
import pool from "../db/pool.js";

dotenv.config();

export async function syncMediaExclusions() {

  console.log("========== MEDIA EXCLUSIONS ==========");

  await syncRadarrExclusions();
  await syncSonarrExclusions();

  console.log("========== COMPLETE ==========");
}

async function syncRadarrExclusions() {

  try {

    const { data } = await axios.get(
      `${process.env.RADARR_URL}/api/v3/exclusions`,
      {
        headers: {
          "X-Api-Key": process.env.RADARR_API_KEY
        }
      }
    );

    console.log(
      `Radarr exclusions: ${data.length}`
    );

    for (const item of data) {

      await pool.query(`
        INSERT INTO media_exclusions (
          source,
          external_id,
          title,
          tmdb_id,
          last_seen
        )
        VALUES (
          'radarr',
          $1,$2,$3,NOW()
        )
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          tmdb_id = EXCLUDED.tmdb_id,
          last_seen = NOW()
      `, [
        item.id,
        item.movieTitle || item.title,
        item.tmdbId
      ]);

      console.log(
        `[RADARR] ${item.movieTitle || item.title}`
      );
    }

  } catch (err) {

    console.error(
      "Radarr exclusion sync failed:",
      err.message
    );
  }
}

async function syncSonarrExclusions() {

  try {

    const { data } = await axios.get(
      `${process.env.SONARR_URL}/api/v3/importlistexclusion`,
      {
        headers: {
          "X-Api-Key": process.env.SONARR_API_KEY
        }
      }
    );

    console.log(
      `Sonarr exclusions: ${data.length}`
    );

    for (const item of data) {

      await pool.query(`
        INSERT INTO media_exclusions (
          source,
          external_id,
          title,
          tvdb_id,
          last_seen
        )
        VALUES (
          'sonarr',
          $1,$2,$3,NOW()
        )
        ON CONFLICT (source, external_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          tvdb_id = EXCLUDED.tvdb_id,
          last_seen = NOW()
      `, [
        item.id,
        item.title,
        item.tvdbId
      ]);

      console.log(
        `[SONARR] ${item.title}`
      );
    }

  } catch (err) {

    console.error(
      "Sonarr exclusion sync failed:",
      err.message
    );
  }
}