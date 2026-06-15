import axios from "axios";
import { load } from "cheerio";
import { saveMagnets } from "../db/saveMagnets.js";
import { delay } from "../delay.js";
import pool from "../db/pool.js";






export async function extractPage(movieUrl) {
  try {
    const response = await axios.get(movieUrl);
    const $ = load(response.data);
    const results = [];

    $("a[href^='magnet:?']").each((i, el) => {
      const magnet = $(el).attr("href");

      // Find nearest logical block (torrent row/card/container)
      const container = $(el).closest("p, div, li, tr");

      const containerText = container.text().replace(/\s+/g, " ").trim();

      // Extract size (MB or GB)
      const sizeMatch = containerText.match(/(\d+(\.\d+)?\s?(MB|GB))/i);

      // Try extracting title
      // Remove magnet text and size from container text
      let title = containerText;

      if (sizeMatch) {
        title = title.replace(sizeMatch[0], "");
      }

      // Remove common junk words
      title = title
        .replace(/magnet/gi, "")
        .replace(/\b(download|torrent|watch)\b/gi, "")
        .trim();

      results.push({
        title: title || "Title not found",
        magnet,
        size: sizeMatch ? sizeMatch[0] : "Size not found",
      });
    });
    const magnetArray = results.map(r => r.magnet);


// new logic added here 
    if(magnetArray.length<=1){
      console.log('Total no of magnet link found is:',magnetArray.length);
try {
  await pool.query(
  "DELETE FROM piratebay_movie_processed_links WHERE href = $1",
  [movieUrl]
);
} catch (error) {
  console.error('error in deletion',error)
}

console.log("Href removed from database");
return

    }
    
    console.log(
  `[${new Date().toLocaleString()}] magnet links are adding....`
);
    await saveMagnets(magnetArray)

  } catch (err) {
    console.error("Error:", err.message);
  }
}



