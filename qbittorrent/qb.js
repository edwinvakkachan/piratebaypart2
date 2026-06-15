import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import dotenv from "dotenv";
import { delay } from "../delay.js";

dotenv.config();

const jar = new CookieJar();
const MOVIE_TAGS = ["piratebay"];

export const qb = wrapper(axios.create({
  baseURL: process.env.QBITIP,
  jar,
  withCredentials: true
}));

export async function loginQB() {
  await qb.post(
    "/api/v2/auth/login",
    new URLSearchParams({
      username: process.env.QBITUSER,
      password: process.env.QBITPASS
    })
  );
}

export async function addMagnet(
  magnet,
  title="",
  category
) {
  const today = new Date().toISOString().split("T")[0];
  const params = new URLSearchParams({
    urls: magnet,
    category,
    tags: [...MOVIE_TAGS,`piratebay.${today}`].join(",")
  });

  if (title) {
    params.set("rename", title);
  }

  await qb.post("/api/v2/torrents/add", params);
}

export async function moveTorrentToTop() {
  const today = new Date().toISOString().split("T")[0];
  const expectedTags = [...MOVIE_TAGS, today];

  const { data: torrents } = await qb.get("/api/v2/torrents/info");

  const addedTorrents = torrents.filter((torrent) =>
    expectedTags.every((tag) => torrent.tags && torrent.tags.includes(tag))
  );

  if (addedTorrents.length === 0) {
    console.log("No Pirate Bay movie torrents found to move.");
    return;
  }

  const hashes = addedTorrents.map((torrent) => torrent.hash).join("|");

  await delay(2000);

  await qb.post(
    "/api/v2/torrents/topPrio",
    new URLSearchParams({ hashes })
  );

  console.log(`Moved ${addedTorrents.length} Pirate Bay movie torrents to top.`);
}


export async function isQBittorrentAvailable() {
  try {

    const { data } = await qb.get("/api/v2/app/version");

    console.log(`qBittorrent version: ${data}`);

    return true;
  } catch (error) {
    console.error(
      "qBittorrent unavailable:",
      error.response?.data || error.message
    );

    return false;
  }
}

export async function radarrToTorrent(magnet){
const today = new Date().toISOString().split("T")[0];

const params = new URLSearchParams({
    urls: magnet,
    category:'2tbEnglish',
    tags: [...MOVIE_TAGS,`piratebay.${today}`,'Fromtraklist'].join(",")
  });

await qb.post("/api/v2/torrents/add", params);

}
export async function SonnarToTorrent(magnet){
const today = new Date().toISOString().split("T")[0];

const params = new URLSearchParams({
    urls: magnet,
    category:'qbit4tbTV',
    tags: [...MOVIE_TAGS,`piratebay.${today}`,'Fromtraklist','tvtorrents'].join(",")
  });

await qb.post("/api/v2/torrents/add", params);

}

