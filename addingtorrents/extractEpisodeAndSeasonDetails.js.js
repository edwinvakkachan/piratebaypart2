
import pool from "../db/pool.js";




function extractSeasonEpisode(title) {
  const match = title.match(/S(\d+)E(\d+)/i);

  if (!match) {
    return {
      season: null,
      episode: null
    };
  }

  return {
    season: parseInt(match[1], 10),
    episode: parseInt(match[2], 10)
  };
}

export async function extractEpisodeAndSeasonDetails() {
console.log('running extractEpisodeAndSeasonDetails()')
  const imdbids = await pool.query(`
    SELECT DISTINCT imdb_id
    FROM trakt_cache
    WHERE trakt_type = 'tv'
      AND imdb_id IS NOT NULL
  `);

  for (const row of imdbids.rows) {

    const shows = await pool.query(`
      SELECT id, title
      FROM piratebay_movie_magnets
      WHERE imdb_id = $1
    `, [row.imdb_id]);

    for (const show of shows.rows) {
console.log(show.title);
      const { season, episode } =
        extractSeasonEpisode(show.title);

      await pool.query(`
        UPDATE piratebay_movie_magnets
        SET season = $1,
            episode = $2
        WHERE id = $3
      `, [
        season,
        episode,
        show.id
      ]);
    }
  }
}