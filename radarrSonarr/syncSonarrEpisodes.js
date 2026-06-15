import axios from "axios";
import pool from "../db/pool.js";

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function syncSonarrEpisodes() {

  console.log("================================");
  console.log("📺 Syncing Sonarr Episodes");
  console.log("================================");

  const { rows: seriesRows } = await pool.query(`
    SELECT id, external_id, title
    FROM radarrsonarr
    WHERE source = 'sonarr'
      AND removed = FALSE
  `);

  let inserted = 0;
  let updated = 0;

  for (const series of seriesRows) {

    console.log(
      `📺 ${series.title} (${series.external_id})`
    );

    try {

      const { data: episodes } = await axios.get(
        `${SONARR_URL}/api/v3/episode`,
        {
          params: {
            seriesId: series.external_id
          },
          headers: {
            "X-Api-Key": SONARR_API_KEY
          }
        }
      );

console.log(
  `📺 ${series.title} (${episodes.length} episodes)`
);
let count = 0;
      for (const ep of episodes) {

        count++;

  if (count % 100 === 0) {
    console.log(
      `${series.title}: ${count}/${episodes.length}`
    );
  }

const result = await pool.query(
  `
  INSERT INTO radarrsonarr_episodes (
    series_id,
    sonarr_series_id,
    episode_id,
    season_number,
    episode_number,
    title,
    air_date,
    monitored,
    has_file,
    updated_at
  )
  VALUES (
    $1,$2,$3,$4,$5,
    $6,$7,$8,$9,
    NOW()
  )
  ON CONFLICT (episode_id)
  DO UPDATE SET
    series_id        = EXCLUDED.series_id,
    sonarr_series_id = EXCLUDED.sonarr_series_id,
    season_number    = EXCLUDED.season_number,
    episode_number   = EXCLUDED.episode_number,
    title            = EXCLUDED.title,
    air_date         = EXCLUDED.air_date,
    monitored        = EXCLUDED.monitored,
    has_file         = EXCLUDED.has_file,
    updated_at       = NOW()
  RETURNING xmax = 0 AS inserted
  `,
  [
    series.id,
    ep.seriesId,
    ep.id,
    ep.seasonNumber,
    ep.episodeNumber,
    ep.title,
    ep.airDateUtc,
    ep.monitored,
    ep.hasFile
  ]
);

        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }

        

      }

    } catch (error) {

      console.error(
        `❌ ${series.title}:`,
        error.response?.status || error.message
      );

    }
  }

  console.log(`✅ Episodes inserted: ${inserted}`);
  console.log(`🔄 Episodes updated : ${updated}`);
}