import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const RADARR_URL = process.env.RADARR_URL;
const RADARR_API_KEY = process.env.RADARR_API_KEY;

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

export async function checkRadarr() {
  try {
    const { data } = await axios.get(
      `${RADARR_URL}/api/v3/system/status`,
      {
        headers: {
          "X-Api-Key": RADARR_API_KEY
        }
      }
    );

    console.log("✅ Radarr Online");
    console.log(`Version: ${data.version}`);
    return true;
  } catch (err) {
    console.log("❌ Radarr Offline");
    console.log(err.response?.data || err.message);
  }
}

export async function checkSonarr() {
  try {
    const { data } = await axios.get(
      `${SONARR_URL}/api/v3/system/status`,
      {
        headers: {
          "X-Api-Key": SONARR_API_KEY
        }
      }
    );

    console.log("✅ Sonarr Online");
    console.log(`Version: ${data.version}`);
    return true;
  } catch (err) {
    console.log("❌ Sonarr Offline");
    console.log(err.response?.data || err.message);
  }
}

