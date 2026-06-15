import pool from "../db/pool.js";

function parseTitle(title) {

  const originalTitle = title;

  // Find year anywhere in title
  const yearMatch = title.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0]) : null;

  let searchTitle = title
    .replace(/\./g, " ")

    // remove season/episode info
    .replace(/\bS\d{1,2}E\d{1,2}\b.*$/i, "")
    .replace(/\bS\d{1,2}\b.*$/i, "")

    // remove quality tags
    .replace(
      /\b(2160p|1080p|720p|480p|WEBRip|WEB-DL|BluRay|HDRip|DVDRip|BRRip|x264|x265|HEVC|AAC|DDP5\.1|AMZN|NF)\b.*$/i,
      ""
    )

    // remove brackets
    .replace(/\[.*?\]/g, "")
    .replace(/\(.*?\)/g, "")

    .replace(/\s+/g, " ")
    .replace(/[()[\]]/g, "")
    .trim();

  return {
    searchTitle,
    year,
    originalTitle
  };
}

function detectMediaType(title, dbMediaType) {

  const tvPatterns = [
    /\bS\d{1,2}E\d{1,2}\b/i,
    /\bE\d{1,2}\b/i,
    /\bSeason\s+\d+\b/i,
    /\bSeasons\s+\d+\b/i,
    /\bComplete\s+Series\b/i,
    /\bComplete\s+Season\b/i
  ];

  if (tvPatterns.some(p => p.test(title))) {
    return "show";
  }

  return dbMediaType === "tv"
    ? "show"
    : "movie";
}

export async function buildTraktCache() {

  console.log("========== BUILDING TRAKT CACHE ==========");

  const torrents = await pool.query(`
   SELECT
  DISTINCT imdb_id,
  MIN(title) AS title
FROM piratebay_movie_magnets
WHERE imdb_id IS NOT NULL
GROUP BY imdb_id
ORDER BY imdb_id
  `);

  console.log(`Found ${torrents.rowCount} torrents`);

let cacheCreated = 0;

 for (const torrent of torrents.rows) {

  let existingCache = { rowCount: 0 };

  if (torrent.imdb_id) {
    existingCache = await pool.query(`
      SELECT id
      FROM trakt_cache
      WHERE imdb_id = $1
      LIMIT 1
    `, [torrent.imdb_id]);
  }

  if (existingCache.rowCount === 0) {

    const insertedCache = await pool.query(`
      INSERT INTO trakt_cache (
        original_title,
        imdb_id,
        trakt_status
      )
      VALUES (
        $1,
        $2,
        'pending'
      )
      RETURNING id
    `, [
      torrent.title,
      torrent.imdb_id
    ]);

    cacheCreated++;

    console.log(
      `[CACHE] ${torrent.title}`
    );
  }
}

  console.log("========== COMPLETE ==========");
  console.log(`Cache entries created: ${cacheCreated}`);
}