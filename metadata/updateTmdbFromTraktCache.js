import axios from "axios";
import pool from "../db/pool.js";

const RADARR_URL = process.env.RADARR_URL;
const RADARR_API_KEY = process.env.RADARR_API_KEY;
const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function updateTmdbIdsForRadarr() {

  const result = await pool.query(`
    SELECT
      id,
      imdb_id,
      clean_title
    FROM trakt_cache
    WHERE trakt_type = 'movie'
    AND imdb_id IS NOT NULL
      AND tmdb_id IS NULL
        AND year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
        AND COALESCE(trakt_status,'pending') <> 'added'
    ORDER BY id
  `);

  console.log(
    `Found ${result.rows.length} movies`
  );

  for (const movie of result.rows) {

    try {

const lookup = await axios.get(
  `${RADARR_URL}/api/v3/movie/lookup/imdb?imdbId=${movie.imdb_id}`,
  {
    headers: {
      "X-Api-Key": RADARR_API_KEY
    }
  }
);

      const tmdbId = lookup.data.tmdbId;

      if (!tmdbId) {
        console.log(
          `❌ No TMDB ID for ${movie.imdb_id}`
        );
        continue;
      }

      await pool.query(`
        UPDATE trakt_cache
        SET
          tmdb_id = $1,
          last_checked = NOW()
        WHERE id = $2
      `, [
        tmdbId,
        movie.id
      ]);

      console.log(
        `✅ ${movie.clean_title} -> ${tmdbId}`
      );

    } catch (err) {

      console.log(
        `❌ Failed: ${movie.imdb_id}`
      );

    //   console.log(
    //     err.response?.data || err.message
    //   );
    }
  }
}

export async function updateTvdbIdsForSonarr() {
try {
    
  const result = await pool.query(`
    SELECT
      id,
      imdb_id,
      clean_title
    FROM trakt_cache
    WHERE trakt_type = 'tv'
    AND imdb_id IS NOT NULL
      AND tvdb_id IS NULL
    ORDER BY id
  `);

 if (!result.rows.length) {
  throw new Error(`NO Series found `);
}

for (const show of result.rows){
          console.log(
        `📺 Adding TVDB id : ${show.clean_title}`
      );

const lookup = await axios.get(
  `${SONARR_URL}/api/v3/series/lookup?term=imdb:${show.imdb_id}`,
  {
    headers: {
      "X-Api-Key": SONARR_API_KEY
    }
  }
);

if (!lookup.data.length) {
  console.log(
    `❌ Series not found for ${show.imdb_id}`
  );
  continue;
}

const series = lookup.data[0];
const tvdbId= series.tvdbId;
 if (!tvdbId) {
        console.log(
          `❌ No TVDB  ID for ${show.imdb_id}`
        );
        continue;
      }

await pool.query(`
  UPDATE trakt_cache
  SET
    tvdb_id = $1,
    last_checked = NOW()
  WHERE id = $2
`, [
  tvdbId,
  show.id
]);

console.log(
        `✅ ${show.clean_title} -> ${tvdbId}`
      );
}
      

} catch (error) {
    console.log(error)
}

}