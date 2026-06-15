import axios from "axios";
import pool from "../db/pool.js";

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function syncSonarrEpisodeFiles() {

  console.log("================================");
  console.log("📂 Syncing Sonarr Episode Files");
  console.log("================================");

  const { rows: seriesRows } = await pool.query(`
    SELECT id, external_id, title
    FROM radarrsonarr
    WHERE source = 'sonarr'
      AND removed = FALSE
  `);

  let updated = 0;

  for (const series of seriesRows) {

    try {

      console.log(
        `📺 ${series.title}`
      );

      const { data: files } = await axios.get(
        `${SONARR_URL}/api/v3/episodefile`,
        {
          params: {
            seriesId: series.external_id
          },
          headers: {
            "X-Api-Key": SONARR_API_KEY
          }
        }
      );

      for (const file of files) {

        const quality =
          file.quality?.quality?.name || null;

        const mediaInfo =
          file.mediaInfo || null;

        for (const episodeId of file.episodeIds || []) {

          await pool.query(`
            UPDATE radarrsonarr_episodes
            SET
              episode_file_id = $1,
              file_size = $2,
              quality = $3,
              relative_path = $4,
              media_info = $5,
              has_file = TRUE,
              updated_at = NOW()
            WHERE episode_id = $6
          `, [
            file.id,
            file.size,
            quality,
            file.relativePath,
            JSON.stringify(mediaInfo),
            episodeId
          ]);

          updated++;
        }
      }

    } catch (error) {

      console.error(
        `❌ ${series.title}`,
        error.response?.status || error.message
      );

    }
  }

  console.log(
    `✅ Episode files updated: ${updated}`
  );
}