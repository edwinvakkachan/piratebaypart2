import axios from "axios";
import pool from "../db/pool.js";

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function syncSonarrSeries() {

  console.log("================================");
  console.log("📺 Syncing Sonarr Series");
  console.log("================================");

  const { data: seriesList } = await axios.get(
    `${SONARR_URL}/api/v3/series`,
    {
      headers: {
        "X-Api-Key": SONARR_API_KEY
      }
    }
  );

  let inserted = 0;
  let updated = 0;

  for (const series of seriesList) {

    const result = await pool.query(
      `
      INSERT INTO radarrsonarr (
        source,
        external_id,
        title,
        year,
        tvdb_id,
        imdb_id,
        path,
        status,
        monitored,
        size_on_disk,
        added,
        removed
      )
      VALUES (
        'sonarr',
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        FALSE
      )
      ON CONFLICT (source, external_id)
      DO UPDATE SET
        title        = EXCLUDED.title,
        year         = EXCLUDED.year,
        tvdb_id      = EXCLUDED.tvdb_id,
        imdb_id      = EXCLUDED.imdb_id,
        path         = EXCLUDED.path,
        status       = EXCLUDED.status,
        monitored    = EXCLUDED.monitored,
        size_on_disk = EXCLUDED.size_on_disk
      RETURNING xmax = 0 AS inserted
      `,
      [
        series.id,
        series.title,
        series.year,
        series.tvdbId,
        series.imdbId,
        series.path,
        series.status,
        series.monitored,
        series.statistics?.sizeOnDisk || 0,
        series.added
      ]
    );

    if (result.rows[0].inserted) {
      inserted++;
    } else {
      updated++;
    }
  }

  console.log(`✅ Inserted: ${inserted}`);
  console.log(`🔄 Updated : ${updated}`);
}





