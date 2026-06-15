// import { initDB } from "./db/db.js";
import { loginQB, addMagnet,moveTorrentToTop } from "./qbittorrent/qb.js";
import pool from "./db/pool.js";
import { delay } from "./delay.js";

function getSeasonKey(title) {
  const seasonMatch = title.match(
    /(season\s*(\d+)|s(\d+))/i
  );

  if (!seasonMatch) return null;

  const season =
    seasonMatch[2] || seasonMatch[3];

  const showName = title
    .replace(/season\s*\d+.*/i, "")
    .replace(/s\d+.*/i, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return `${showName}-season-${season}`;
}

function getEpisodeKey(title) {
  const match = title.match(/S(\d+)E(\d+)/i);

  if (!match) return null;

  const showName = title
    .replace(/S\d+E\d+.*/i, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return `${showName}-s${match[1]}e${match[2]}`;
}

function normalizeShowName(title) {
  return title
    .replace(/\.(720p|1080p|2160p).*/i, "")
    .replace(/\b(720p|1080p|2160p)\b.*/i, "")
    .replace(/S\d+E\d+.*/i, "")
    .replace(/[._-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}


export async function addToTorrent() {
  try {
   

const MIN_MOVIE_YEAR = 2025;

const ONE_GB = 1024 * 1024 * 1024;
const THREE_GB = 3 * ONE_GB;

const result = await pool.query(`
  SELECT *
  FROM piratebay_movie_magnets
  WHERE sent_to_qbittorrent = FALSE
  AND COALESCE(skipped_duplicate,FALSE) = FALSE
    AND (
      (
        media_type = 'tv'
        AND (
          size IS NULL
          OR CAST(size AS BIGINT) < ${ONE_GB}
        )
      )
      OR
      (
        media_type = 'movie'
        AND (
          size IS NULL
          OR CAST(size AS BIGINT) < ${THREE_GB}
        )
        AND CAST(
          substring(title FROM '(19|20)[0-9]{2}')
          AS INTEGER
        ) >= $1
      )
    )
  ORDER BY created_at ASC
`, [MIN_MOVIE_YEAR]);

    const rows = result.rows;
const episodeMap = new Map();
const duplicateIds = [];

for (const row of rows) {
  if (row.media_type !== "tv") {
    episodeMap.set(`movie-${row.id}`, row);
    continue;
  }

  const match = row.title.match(/S(\d+)E(\d+)/i);

  if (!match) {
    episodeMap.set(`tv-${row.id}`, row);
    continue;
  }



const showName = normalizeShowName(row.title);

const key = `${showName}-S${match[1]}E${match[2]}`;

  const existing = episodeMap.get(key);



 if (!existing) {
  episodeMap.set(key, row);
} else if (
  Number(row.seeders) > Number(existing.seeders)
) {
  duplicateIds.push(existing.id);
  episodeMap.set(key, row);
} else {
  duplicateIds.push(row.id);
}


}

const filteredRows = [...episodeMap.values()];

console.log(
  `Original: ${rows.length}, Filtered: ${filteredRows.length}`
);



if (duplicateIds.length > 0) {
 await pool.query(
`
UPDATE piratebay_movie_magnets
SET skipped_duplicate = TRUE,
    sent_to_qbittorrent = TRUE
WHERE id = ANY($1)
`,
[duplicateIds]
);

  console.log(
    `Marked ${duplicateIds.length} duplicates`
  );
}

    await loginQB();
    console.log("adding torrents from DB");

    for (const value of filteredRows) {
 try {

  const category =
  value.media_type === "tv"
    ? "qbit4tbTV"
    : "2tbEnglish";

const episodeKey = getEpisodeKey(value.title);

if (episodeKey) {
  const exists = await pool.query(
    `
    SELECT 1
    FROM downloaded_episodes
    WHERE episode_key = $1
    `,
    [episodeKey]
  );

  if (exists.rowCount > 0) {
    console.log(`Already downloaded: ${episodeKey}`);

    await pool.query(
      `
      UPDATE piratebay_movie_magnets
SET skipped_duplicate = TRUE,
    sent_to_qbittorrent = TRUE
WHERE id = $1
      `,
      [value.id]
    );

    continue;
  }
}
//checking for sessional pack 

const isSeasonPack =
  /complete|season pack|full season|complete series|full series/i.test(
    value.title
  );

const seasonKey = getSeasonKey(value.title);

if (isSeasonPack && seasonKey) {
  const exists = await pool.query(
    `
    SELECT 1
    FROM downloaded_seasons
    WHERE season_key = $1
    `,
    [seasonKey]
  );

  if (exists.rowCount > 0) {
    console.log(
      `Season already downloaded: ${seasonKey}`
    );

    await pool.query(
      `
      UPDATE piratebay_movie_magnets
      SET skipped_duplicate = TRUE,
          sent_to_qbittorrent = TRUE
      WHERE id = $1
      `,
      [value.id]
    );

    continue;
  }
}




await addMagnet(
  value.magnet,
  value.title,
  category
);


if (isSeasonPack && seasonKey) {
  await pool.query(
    `
    INSERT INTO downloaded_seasons
    (season_key)
    VALUES ($1)
    ON CONFLICT DO NOTHING
    `,
    [seasonKey]
  );
}

if (episodeKey) {
  await pool.query(
    `
    INSERT INTO downloaded_episodes (episode_key)
    VALUES ($1)
    ON CONFLICT DO NOTHING
    `,
    [episodeKey]
  );
}

  await pool.query(
    `UPDATE piratebay_movie_magnets
     SET sent_to_qbittorrent = TRUE
     WHERE id = $1`,
    [value.id]
  );
} catch (error) {
  console.error(`Failed to add: ${value.title}`);
}
    }

    console.log("adding complete");
 await delay(1000);
 await moveTorrentToTop();
  } catch (error) {
    console.error(error);
  }
}
