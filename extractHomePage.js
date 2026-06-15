import axios from "axios";
import { getSearchUrl } from "./getBaseUrlFromDB.js";
import { publishMessage } from "./queue/publishMessage.js";

function buildApiUrl(searchUrl) {
  try {
    const url = new URL(searchUrl);

    const query = url.searchParams.get("q");

    if (!query) {
      throw new Error("No search query found in URL");
    }

    return `https://apibay.org/q.php?q=${encodeURIComponent(query)}`;
  } catch (err) {
    throw new Error(`Unable to build API URL: ${err.message}`);
  }
}

export async function scrapePirateBayMovieMagnets() {
  try {
    const searchUrl = await getSearchUrl();

    console.log(`Current search URL: ${searchUrl}`);

    const apiUrl = buildApiUrl(searchUrl);

    console.log(`Using API URL: ${apiUrl}`);

    await publishMessage({
      message: `Using Pirate Bay API: ${apiUrl}`
    });

    const { data } = await axios.get(apiUrl, {
      timeout: 30000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36"
      }
    });

    if (!Array.isArray(data)) {
      console.error("API returned invalid data");
      return [];
    }

    const torrents = data
      .filter(
        (item) =>
          item.info_hash &&
          item.info_hash !== "0000000000000000000000000000000000000000"
      )
      .map((item) => ({
        title: item.name,
        magnet:
          `magnet:?xt=urn:btih:${item.info_hash}` +
          `&dn=${encodeURIComponent(item.name)}`,
        sourceUrl: `https://thepiratebay.org/description.php?id=${item.id}`,
        size: item.size,
        seeders: Number(item.seeders || 0),
        leechers: Number(item.leechers || 0)
      }));

    console.log(
      `Total Pirate Bay movie magnets found: ${torrents.length}`
    );

    return torrents;
  } catch (error) {
    console.error("Pirate Bay API error:", error.message);
    return [];
  }
}