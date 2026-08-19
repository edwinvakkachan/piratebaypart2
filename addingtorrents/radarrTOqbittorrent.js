import pool from "../db/pool.js";
import axios from "axios";
import { addMagnet } from "../qbittorrent/qb.js";
import { selectBestTorrent } from "./selectingBestTorrent.js";

function getQuality(title) {
  const match = title?.match(
    /\b(360p|480p|576p|720p|1080p|1440p|2160p|4K)\b/i
  );

  // Default quality
  if (!match) {
    return "1080p";
  }

  return match[1].toLowerCase() === "4k"
    ? "2160p"
    : match[1].toLowerCase();
}


function getLanguage(row) {
  // If language exists in DB, use it.
  // Otherwise default to English.
  if (row.language && row.language.trim()) {
    return row.language.trim();
  }

  return "English";
}


function buildTorrentTitle(row) {
  const cleanTitle = row.clean_title || row.title;

  const quality = getQuality(row.title);
  const language = getLanguage(row);

  const year = row.year || "";

  // Make title Radarr/Sonarr friendly
  const safeTitle = cleanTitle
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, ".");

  return [
    safeTitle,
    year,
    quality,
    "WEB-DL",
    language
  ]
    .filter(Boolean)
    .join(".");
}


function modifyMagnetMetadata(magnet, row) {
  if (!magnet) {
    return magnet;
  }

  try {
    const url = new URL(magnet);

    const torrentTitle = buildTorrentTitle(row);

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
      "Failed to modify magnet:",
      error
    );

    return magnet;
  }
}




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



const torrentResult = await pool.query(`
  SELECT *
  FROM piratebay_movie_magnets
  WHERE imdb_id = $1
    AND sent_to_qbittorrent = FALSE
  ORDER BY id
`, [item.imdb_id]);


   if (torrentResult.rows.length === 0) {
        console.log(item.imdb_id)
        console.log(`❌ No torrent found`);
        notFound++;
        continue;
      }

const torrent = await selectBestTorrent(torrentResult.rows);

   


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

const category = '2tbEnglish';

const modifiedMagnet = modifyMagnetMetadata(torrent.magnet,torrent);

const torrentTitle = buildTorrentTitle(torrent);

await addMagnet(modifiedMagnet, category,torrentTitle);


        await pool.query(`
          UPDATE piratebay_movie_magnets
          SET sent_to_qbittorrent = TRUE
          WHERE id = $1
        `, [torrent.id]);

// await pool.query(`
//   UPDATE piratebay_movie_magnets
//   SET skipped_duplicate = TRUE
//   WHERE imdb_id = $1
//     AND id <> $2
//     AND sent_to_qbittorrent = FALSE
// `, [torrent.imdb_id, torrent.id]);

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