import axios from "axios";
import pool from "../db/pool.js";

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function syncSonarrSeasons() {

  console.log("================================");
  console.log("📚 Syncing Sonarr Seasons");
  console.log("================================");

  const { data: seriesList } = await axios.get(
    `${SONARR_URL}/api/v3/series`,
    {
      headers: {
        "X-Api-Key": SONARR_API_KEY
      }
    }
  );

  let seasonsProcessed = 0;

  for (const series of seriesList) {

    for (const season of series.seasons || []) {
        console.log('processing');

      await pool.query(`
        INSERT INTO radarrsonarr_seasons (
          series_id,
          season_number,
          monitored,
          statistics_size_on_disk,
          episode_count,
          total_episode_count
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (series_id, season_number)
        DO UPDATE SET
          monitored = EXCLUDED.monitored,
          statistics_size_on_disk = EXCLUDED.statistics_size_on_disk,
          episode_count = EXCLUDED.episode_count,
          total_episode_count = EXCLUDED.total_episode_count
      `, [
        series.id,
        season.seasonNumber,
        season.monitored,
        season.statistics?.sizeOnDisk || 0,
        season.statistics?.episodeCount || 0,
        season.statistics?.totalEpisodeCount || 0
      ]);

      seasonsProcessed++;
    }
  }

  console.log(`✅ Seasons processed: ${seasonsProcessed}`);
}