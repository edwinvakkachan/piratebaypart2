import axios from "axios";
import pool from "../db/pool.js";

export async function piratebaymovie() {

  const res = await axios.get(
    "https://apibay.org/q.php?q=category:201",
    {
      timeout: 30000
    }
  );

  const torrents = res.data;

  for (const torrent of torrents) {

    const magnet =
      `magnet:?xt=urn:btih:${torrent.info_hash}` +
      `&dn=${encodeURIComponent(torrent.name)}`;

    await pool.query(`
      INSERT INTO piratebay_movie_magnets (
        title,
        magnet,
        source_url,
        size,
        seeders,
        leechers,
        imdb_id,
        metadata_status,
        sent_to_qbittorrent,
        skipped_duplicate
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        'pending',
        FALSE,
        FALSE
      )
      ON CONFLICT (magnet)
      DO NOTHING
    `, [
      torrent.name,
      magnet,
      `https://thepiratebay.org/description.php?id=${torrent.id}`,
      torrent.size,
      torrent.seeders,
      torrent.leechers,
      torrent.imdb,
    ]);
  }
}

export async function piratebayTv() {

  console.log("\n========== PIRATE BAY TV START ==========");

  const res = await axios.get(
    "https://apibay.org/q.php?q=category:205",
    {
      timeout: 30000
    }
  );

  const torrents = res.data;

  let inserted = 0;

  for (const torrent of torrents) {

    if (!torrent.info_hash) continue;

    const magnet =
      `magnet:?xt=urn:btih:${torrent.info_hash}` +
      `&dn=${encodeURIComponent(torrent.name)}`;

    await pool.query(`
      INSERT INTO piratebay_movie_magnets (
        title,
        magnet,
        source_url,
        size,
        seeders,
        leechers,
        imdb_id,
        metadata_status,
        sent_to_qbittorrent,
        skipped_duplicate
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        'pending',
        FALSE,
        FALSE
      )
      ON CONFLICT (magnet)
      DO NOTHING
    `, [
      torrent.name,
      magnet,
      `https://thepiratebay.org/description.php?id=${torrent.id}`,
      torrent.size,
      Number(torrent.seeders || 0),
      Number(torrent.leechers || 0),
      torrent.imdb
    ]);

    inserted++;
  }

  console.log(`TV torrents inserted: ${inserted}`);
}