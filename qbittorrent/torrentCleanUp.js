import { qb } from "./qb.js";
import { publishMessage } from "../queue/publishMessage.js";
const TWO_GB = 2 * 1024 * 1024 * 1024;

function getTodayTag() {
  return new Date().toISOString().split("T")[0];
}

export async function getTorrentsByTag(tag) {
  const { data } = await qb.get("/api/v2/torrents/info", {
    params: { tag }
  });
  return data;
}

export async function deleteTorrents(hashes) {
  if (!hashes.length) return;

  await qb.post(
    "/api/v2/torrents/delete",
    new URLSearchParams({
      hashes: hashes.join("|"),
      deleteFiles: "true"
    })
  );
}



function extractMovieKey(name) {
  const match = name.match(/-\s*(.+?\(\d{4}\))/);

  if (match) {
    return match[1].trim().toLowerCase();
  }

  // fallback if pattern fails
  return name
    .replace(/\b(2160p|1080p|720p|480p|x265|x264|HEVC|HDRip|WEB-DL|AAC|DD5\.1)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Select best torrent from a group
 */
function selectBestTorrent(torrents) {
  // Prefer 1080p under 2GB
  const candidates = torrents.filter(t =>
    /1080p/i.test(t.name) && t.size < TWO_GB
  );

  if (candidates.length > 0) {
    return candidates.sort((a, b) => b.size - a.size)[0];
  }

  // fallback: best overall under 2GB
  const under2gb = torrents.filter(t => t.size < TWO_GB);
  if (under2gb.length > 0) {
    return under2gb.sort((a, b) => b.size - a.size)[0];
  }

  // final fallback: largest
  return torrents.sort((a, b) => b.size - a.size)[0];
}

export async function cleanupTodayTorrents() {
  const tag = getTodayTag();
  const torrents = await getTorrentsByTag(tag);

  if (!torrents.length) {
    console.log("No torrents found for today.");
    try {
          await publishMessage({
        message: "No torrents found for today."
      });
    } catch (error) {
      console.log(error)
    }
    return;
  }

  // 🔥 Step 1 — Group by movie
  const grouped = {};

  for (const torrent of torrents) {
    const key = extractMovieKey(torrent.name);

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(torrent);
  }

  const hashesToDelete = [];

  // 🔥 Step 2 — Select best per movie
  for (const movie in grouped) {
    const group = grouped[movie];

    if (group.length === 1) continue; // no duplicates

    const best = selectBestTorrent(group);

    console.log(`Keeping for "${movie}":`, best.name);
    group
      .filter(t => t.hash !== best.hash)
      .forEach(t => hashesToDelete.push(t.hash));
  }

  if (hashesToDelete.length) {
    await deleteTorrents(hashesToDelete);
    console.log("Duplicate torrents deleted.");
    try {

          await publishMessage({
        message: 'Duplicate torrents deleted.'
      });
    } catch (error) {
      console.log(error)
    }
  } else {
    console.log("No duplicates found.");
    try {
          await publishMessage({
        message: 'No duplicates found.'
      });
    } catch (error) {
      console.log(error)
    }
  }
}


const THREE_GB = 3 * 1024 * 1024 * 1024;

export async function deleteLargePirateBayTorrents() {
  const torrents = await getTorrentsByTag("piratebay");

  const largeTorrents = torrents.filter(
    torrent => torrent.size > THREE_GB
  );

  if (!largeTorrents.length) {
    console.log("No piratebay torrents larger than 3GB.");
    return;
  }

  largeTorrents.forEach(t => {
    console.log(
      `DELETE: ${t.name} (${(t.size / 1024 / 1024 / 1024).toFixed(2)} GB)`
    );
  });

  await deleteTorrents(
    largeTorrents.map(t => t.hash)
  );

  await publishMessage({
    message: `Deleted ${largeTorrents.length} piratebay torrents larger than 3GB`
  });
}