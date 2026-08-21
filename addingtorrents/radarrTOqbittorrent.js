import pool from "../db/pool.js";
import axios from "axios";
import { addMagnet } from "../qbittorrent/qb.js";
import { selectBestTorrent } from "./selectingBestTorrent.js";


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


/**
 * Build the torrent display/name using:
 *
 *   Radarr title + Radarr year
 *   Torrent quality + language
 *
 * This is important because the torrent title may contain
 * a different/inaccurate movie title or year.
 */
function buildTorrentTitle(radarrItem, torrent) {
  if (!radarrItem?.title) {
    throw new Error("Radarr movie title is missing");
  }

  // ALWAYS use the title from Radarr
  const cleanTitle = radarrItem.title
    .replace(/[._-]+/g, " ")
    .replace(/[:/\\|*?"<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Convert spaces to dots for Radarr-friendly naming
  const safeTitle = cleanTitle.replace(/\s+/g, ".");

  // Quality comes from the actual torrent
  const quality = getQuality(torrent?.title);

  // Language comes from torrent metadata
  const language = getLanguage(torrent);

  // Year ALWAYS comes from Radarr
  const year = radarrItem.year || "";

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


function modifyMagnetMetadata(magnet, radarrItem, torrent) {
  if (!magnet) {
    return magnet;
  }

  try {
    const url = new URL(magnet);

    const torrentTitle = buildTorrentTitle(radarrItem, torrent);

    // Change magnet display name
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


const category = "2tbEnglish";

// IMPORTANT:
// radarrItem = official Radarr metadata
// torrent    = selected torrent metadata

const modifiedMagnet = modifyMagnetMetadata(
  torrent.magnet,
  item,
  torrent
);

const torrentTitle = buildTorrentTitle(
  item,
  torrent
);

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