import pool from "../db/pool.js";
import axios from "axios";
import { addMagnet } from "../qbittorrent/qb.js";
import { selectBestSonarrTorrent } from "./selectingBestSonarrTorrentFile.js";



function getQuality(title) {
  const match = title?.match(
    /\b(360p|480p|576p|720p|1080p|1440p|2160p|4K)\b/i
  );

  if (!match) {
    return "1080p";
  }

  return match[1].toLowerCase() === "4k"
    ? "2160p"
    : match[1].toLowerCase();
}


function getLanguage(row) {
  if (row?.language && row.language.trim()) {
    return row.language.trim();
  }

  return "English";
}


function cleanTitle(title) {
  if (!title) {
    return "";
  }

  return title
    .replace(/[._-]+/g, " ")
    .replace(/[:/\\|*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, ".");
}


/**
 * Build a Sonarr-friendly torrent name.
 *
 * IMPORTANT:
 * Series title and episode title come from our DB,
 * NOT from the torrent title.
 */
function buildSonarrTorrentTitle(item, torrent) {
  if (!item?.series_title) {
    throw new Error("Series title is missing");
  }

  if (!item?.title) {
    throw new Error("Episode title is missing");
  }

  const seriesTitle = cleanTitle(item.series_title);
  const episodeTitle = cleanTitle(item.title);

  const season = `S${String(item.season_number).padStart(2, "0")}`;
  const episode = `E${String(item.episode_number).padStart(2, "0")}`;

  const quality = getQuality(torrent?.title);
  const language = getLanguage(torrent);

  return [
    seriesTitle,
    `${season}${episode}`,
    episodeTitle,
    quality,
    "WEB-DL",
    language
  ]
    .filter(Boolean)
    .join(".");
}


function modifySonarrMagnetMetadata(magnet, item, torrent) {
  if (!magnet) {
    return magnet;
  }

  try {
    const url = new URL(magnet);

    const torrentTitle = buildSonarrTorrentTitle(
      item,
      torrent
    );

    // Replace magnet display name
    url.searchParams.set("dn", torrentTitle);

    const modifiedMagnet = url.toString();

    console.log("Original magnet:");
    console.log(magnet);

    console.log("Modified magnet:");
    console.log(modifiedMagnet);

    console.log("Torrent name:");
    console.log(torrentTitle);

    return modifiedMagnet;

  } catch (error) {
    console.error(
      "Failed to modify Sonarr magnet:",
      error
    );

    return magnet;
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
  FROM piratebay_movie_magnets
  WHERE imdb_id = $1
    AND season = $2
    AND episode = $3
    AND sent_to_qbittorrent = FALSE
`, [
  item.imdb_id,
  item.season_number,
  item.episode_number
]);

if (torrentResult.rows.length === 0) {
  console.log(item.imdb_id);
  console.log(`❌ No torrent found`);
  notFound++;
  continue;
}

const torrent = await selectBestSonarrTorrent(torrentResult.rows);

if (!torrent) {
  console.log(`❌ Could not select a torrent`);
  notFound++;
  continue;
}



console.log(`✅ Best torrent selected:`);
console.log(`   Torrent : ${torrent.title}`);
console.log(`   Seeders : ${torrent.seeders}`);
console.log(
  `   Size    : ${
    (Number(torrent.size) / 1024 / 1024 / 1024).toFixed(2)
  } GB`
);

// AND CAST(size AS BIGINT) < 1073741824

  try {

    // await SonnarToTorrent(torrent.magnet)
     const modifiedMagnet = modifySonarrMagnetMetadata(
    torrent.magnet,
    item,
    torrent
  );

  const torrentTitle = buildSonarrTorrentTitle(
    item,
    torrent
  );

  const category = "qbit4tbTV";

  await addMagnet(
    modifiedMagnet,
    category,
    torrentTitle
  );

await pool.query(`
  UPDATE piratebay_movie_magnets
  SET sent_to_qbittorrent = TRUE
  WHERE id = $1
`, [torrent.id]);


// await pool.query(`
//   UPDATE radarrsonarr_episodes
//   SET grabbed = TRUE,
//       updated_at = NOW()
//   WHERE episode_id = $1
// `, [
//   item.episode_id
// ]);



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