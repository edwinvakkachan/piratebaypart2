import axios from "axios";
import dotenv from "dotenv";
import pool from "../db/pool.js";
import { delay } from "../delay.js";
import { extractEpisodeAndSeasonDetails } from "../addingtorrents/extractEpisodeAndSeasonDetails.js.js";

dotenv.config();

const OMDB_API_KEY = process.env.OMDB_API_KEY;

export async function populateMetadataFromOMDb() {

  console.log("========== OMDB METADATA SYNC ==========");

  const result = await pool.query(`
    SELECT DISTINCT imdb_id
    FROM trakt_cache
    WHERE imdb_id IS NOT NULL
      AND (
        year IS NULL
        OR trakt_type IS NULL
      )
    ORDER BY imdb_id
  `);

  console.log(
    `Found ${result.rowCount} IMDb IDs to process`
  );

  let updated = 0;
  let failed = 0;

  for (const row of result.rows) {

    try {


        if (
  !row.imdb_id ||
  row.imdb_id === "0"
) {
  continue;
}

      const imdbId = row.imdb_id

        

      const res = await axios.get(
        "https://www.omdbapi.com/",
        {
          params: {
            i: imdbId,
            apikey: OMDB_API_KEY
          },
          timeout: 30000
        }
      );

    

      const data = res.data;

      if (data.Response !== "True") {

        console.log(
          `[NOT FOUND] ${imdbId}`
        );

        failed++;
        continue;
      }

      const title = data.Title;

      let year = null;

      if (data.Year) {
        const match = data.Year.match(/\d{4}/);
        if (match) {
          year = parseInt(match[0]);
        }
      }

      let mediaType = null;

      switch (data.Type) {

        case "movie":
          mediaType = "movie";
          break;

        case "series":
          mediaType = "tv";
          break;

        default:
          mediaType = null;
      }

      const metascore =
  data.Metascore && data.Metascore !== "N/A"
    ? parseInt(data.Metascore)
    : null;

const imdbRating =
  data.imdbRating && data.imdbRating !== "N/A"
    ? parseFloat(data.imdbRating)
    : null;
const language =
  data.Language && data.Language !== "N/A"
    ? data.Language
    : null;


      await pool.query(`
        UPDATE trakt_cache
        SET
          clean_title = $1,
          year = $2,
          trakt_type = COALESCE($3, trakt_type),
          Metascore = $4,
          imdb_rating= $5,
          Language= $6
        WHERE imdb_id = $7
      `, [
        title,
        year,
        mediaType,
        metascore,
        imdbRating,
        language,
        imdbId
      ]);

      console.log(
        `[UPDATED] ${imdbId} -> ${title} (${year}) [${mediaType}]`
      );

      updated++;

        await delay(500,true);

    } catch (error) {

      console.error(
        `[ERROR] ${row.imdb_id}:`,
        error.message
      );

      failed++;
    }
  }

  console.log("\n========== COMPLETE ==========");
  console.log(`Updated: ${updated}`);
  console.log(`Failed: ${failed}`);
}