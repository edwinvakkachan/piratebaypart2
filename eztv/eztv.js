import axios from "axios";
import pool from "../db/pool.js";

async function getLastEztvId() {
  const result = await pool.query(
    "SELECT value FROM app_state WHERE key = 'last_eztv_id'"
  );

  return result.rowCount
    ? parseInt(result.rows[0].value, 10)
    : 0;
}

async function setLastEztvId(id) {
  await pool.query(`
    INSERT INTO app_state(key, value)
    VALUES ('last_eztv_id', $1)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value
  `, [String(id)]);
}

export async function eztv() {
  try {
    

  console.log('\n========== EZTV SYNC START ==========');

  const lastKnownId = await getLastEztvId();

  console.log(`Last processed EZTV ID: ${lastKnownId}`);

  let highestIdSeen = lastKnownId;
  let page = 1;
  let stop = false;

  let inserted = 0;
  let duplicates = 0;

  while (!stop) {

    console.log(`\nFetching page ${page}...`);

    const { data } = await axios.get(
      `https://eztvx.to/api/get-torrents?page=${page}`,
      { timeout: 30000 }
    );

    const torrents = data.torrents || [];

    console.log(
      `Page ${page} returned ${torrents.length} torrents`
    );

    if (!torrents.length) {
      console.log('No torrents returned. Stopping.');
      break;
    }

    for (const show of torrents) {

      if (show.id <= lastKnownId) {
        console.log(
          `Reached old torrent ID ${show.id}. Stopping scan.`
        );
        stop = true;
        break;
      }

      if (show.id > highestIdSeen) {
        highestIdSeen = show.id;
      }


        const exists = await pool.query(
          `SELECT 1
           FROM piratebay_movie_magnets
           WHERE magnet = $1
           LIMIT 1`,
          [show.magnet_url]
        );

        if (exists.rowCount > 0) continue;



await pool.query(`
  INSERT INTO piratebay_movie_magnets (
    title,
    magnet,
    source_url,
    size,
    seeders,
    leechers,
    imdb_id,
    created_at,
    sent_to_qbittorrent,
    skipped_duplicate
  )
  VALUES (
    $1,$2,$3,$4,$5,$6,$7,
    NOW(),
    FALSE,
    FALSE
  )
`, [
  show.title,
  show.magnet_url,
  `https://eztvx.to/torrent/${show.id}`,
  show.size_bytes.toString(),
  show.seeds,
  show.peers,
  show.imdb_id ? `tt${show.imdb_id}` : null
]);

      inserted++;

      console.log(
        `Inserted ID ${show.id} | ${show.title}`
      );
    }

    page++;
  }

  if (highestIdSeen > lastKnownId) {

    console.log(
      `Updating last_eztv_id from ${lastKnownId} to ${highestIdSeen}`
    );

    await setLastEztvId(highestIdSeen);
  }

  console.log('\n========== EZTV SYNC COMPLETE ==========');
  console.log(`Inserted: ${inserted}`);
  console.log(`Duplicates: ${duplicates}`);
  console.log(`Highest ID Seen: ${highestIdSeen}`);
  console.log('========================================\n');
  } catch (error) {
    console.log(error);
  }
}
