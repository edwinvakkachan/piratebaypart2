import pool from "../db/pool.js";
import axios from "axios";
import { radarrToTorrent,SonnarToTorrent } from "../qbittorrent/qb.js";
// import { extractEpisodeAndSeasonDetails } from "./extractEpisodeAndSeasonDetails.js.js";






export async function sendMissingRadarrToQbit() {
  console.log("========================================");
  console.log("🚀 Radarr → qBittorrent Started");
  console.log("========================================");

  try {


  const wantedResult = await pool.query(`
  SELECT *
  FROM radarrsonarr
  WHERE removed = FALSE
    AND source = 'radarr'
    AND COALESCE(size_on_disk,0) = 0
    AND EXISTS (
      SELECT 1
      FROM unnest(tag_names) AS tag
      WHERE LOWER(tag) = 'sitescrapemovies'
    )
  ORDER BY title
`);

    console.log(
      `📚 Found ${wantedResult.rows.length} missing movies/shows`
    );

    let added = 0;
    let notFound = 0;

    for (const item of wantedResult.rows) {
      console.log("");
      console.log(
        `🔍 Searching: ${item.title} (${item.source})`
      );

// const torrentResult = await pool.query(`
// SELECT *
// FROM piratebay_movie_magnets
// WHERE imdb_id = $1
//   AND CAST(size AS BIGINT) < 1610612736
//   AND sent_to_qbittorrent = FALSE
//   AND COALESCE(skipped_duplicate,FALSE) = FALSE
// ORDER BY seeders DESC
// LIMIT 1
// `, [item.imdb_id]);

const torrentResult = await pool.query(`
SELECT *
FROM piratebay_movie_magnets
WHERE imdb_id = $1
  AND sent_to_qbittorrent = FALSE
  AND COALESCE(skipped_duplicate,FALSE) = FALSE
ORDER BY seeders DESC
LIMIT 1
`, [item.imdb_id]);

      if (torrentResult.rows.length === 0) {
        console.log(item.imdb_id)
        console.log(`❌ No torrent found`);
        notFound++;
        continue;
      }

      const torrent = torrentResult.rows[0];

      console.log(
        `✅ Match Found`
      );
      console.log(
        `   Torrent : ${torrent.title}`
      );
      console.log(
        `   Seeders : ${torrent.seeders}`
      );
      console.log(
        `   Size    : ${(
          Number(torrent.size) /
          1024 /
          1024 /
          1024
        ).toFixed(2)} GB`
      );

      try {
        await radarrToTorrent(torrent.magnet);


        await pool.query(`
          UPDATE piratebay_movie_magnets
          SET sent_to_qbittorrent = TRUE
          WHERE id = $1
        `, [torrent.id]);

await pool.query(`
  UPDATE piratebay_movie_magnets
  SET skipped_duplicate = TRUE
  WHERE imdb_id = $1
    AND id <> $2
    AND sent_to_qbittorrent = FALSE
`, [torrent.imdb_id, torrent.id]);

        console.log("📥 Sent to qBittorrent");

        added++;
      } catch (err) {
        console.error(
          `❌ qBittorrent Error:`,
          err.message
        );
      }
    }

    console.log("");
    console.log("========================================");
    console.log(`✅ Added     : ${added}`);
    console.log(`❌ Not Found : ${notFound}`);
    console.log("🏁 Completed");
    console.log("========================================");

  } catch (err) {
    console.error(
      "❌ Radarr/Sonarr Sync Failed:",
      err.message
    );
  }
}

export async function sendMissingSonarrToQbit(){
  try {
  console.log("========================================");
  console.log("🚀 Sonarr → qBittorrent Started");
  console.log("========================================");

const showResult = await pool.query(`
  SELECT
    e.*,
    s.title AS series_title,
    s.imdb_id,
    s.tvdb_id
  FROM radarrsonarr_episodes e
  JOIN radarrsonarr s
    ON s.id = e.series_id
  WHERE e.has_file = FALSE
    AND s.removed = FALSE
    AND COALESCE(e.grabbed, FALSE) = FALSE
    AND 'sitescrapeshows' = ANY(s.tag_names)
    AND e.air_date IS NOT NULL
AND e.air_date <= NOW()
AND e.air_date >= NOW() - INTERVAL '6 months'
  ORDER BY e.air_date DESC

`);


  console.log(
      `📚 Found ${showResult.rows.length} missing shows`
    );

    let added = 0;
    let notFound = 0;

    for (const item of showResult.rows) {
      console.log("");
console.log(
  `🔍 Searching: ${item.series_title} S${String(item.season_number).padStart(2,'0')}E${String(item.episode_number).padStart(2,'0')}`
);
console.log(
  `IMDb: ${item.imdb_id} S${item.season_number}E${item.episode_number}`
);

const torrentResult = await pool.query(`
SELECT *
FROM (
    SELECT *,
           ROW_NUMBER() OVER (
               PARTITION BY imdb_id, season, episode
               ORDER BY seeders DESC
           ) AS rn
    FROM piratebay_movie_magnets
    WHERE imdb_id = $1
      AND season = $2
      AND episode = $3
      AND sent_to_qbittorrent = FALSE
) t
WHERE rn = 1
`, [
  item.imdb_id,
  item.season_number,
  item.episode_number
]);
  if (torrentResult.rows.length === 0) {
        console.log(item.imdb_id)
        console.log(`❌ No torrent found`);
        notFound++;
        continue;
      }

// AND CAST(size AS BIGINT) < 1073741824
     
for (const torrent of torrentResult.rows){

  try {

     console.log(
        `✅ Match Found`
      );
      console.log(
        `   Torrent : ${torrent.title}, ${torrent.season} ${torrent.episode}`
      );
      console.log(
        `   Seeders : ${torrent.seeders}`
      );
      console.log(
        `   Size    : ${(
          Number(torrent.size) /
          1024 /
          1024 /
          1024
        ).toFixed(2)} GB`
      );


    await SonnarToTorrent(torrent.magnet)

await pool.query(`
  UPDATE piratebay_movie_magnets
  SET sent_to_qbittorrent = TRUE
  WHERE id = $1
`, [torrent.id]);

    await pool.query(`UPDATE piratebay_movie_magnets
SET skipped_duplicate = TRUE
WHERE imdb_id = $1
  AND season = $2
  AND episode = $3
  AND id <> $4
    `, [torrent.imdb_id,torrent.season,torrent.episode,torrent.id]);


await pool.query(`
  UPDATE radarrsonarr_episodes
  SET grabbed = TRUE,
      updated_at = NOW()
  WHERE episode_id = $1
`, [
  item.episode_id
]);



console.log(
  `✅ Grabbed: ${item.series_title} S${item.season_number}E${item.episode_number}`
);
    console.log("📥 Sent to qBittorrent");

    added++;
  } catch (err) {
    console.error(
      `❌ qBittorrent Error:`,
      err.message
    );
  }
}
    }

    console.log("");
    console.log("========================================");
    console.log(`✅ Added     : ${added}`);
    console.log(`❌ Not Found : ${notFound}`);
    console.log("🏁 Completed");
    console.log("========================================");

  } catch (error) {
    console.log(error);
  }
}