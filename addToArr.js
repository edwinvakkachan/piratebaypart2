import axios from "axios";
import pool from "./db/pool.js";

const RADARR_URL = process.env.RADARR_URL;
const RADARR_API_KEY = process.env.RADARR_API_KEY;

const SONARR_URL = process.env.SONARR_URL;
const SONARR_API_KEY = process.env.SONARR_API_KEY;

const MOVIE_TAGS = [
  "trackenglish",
  "sitescrapemovies"
];

const SHOW_TAGS = [
  "trackedwin",
  "sitescrapeshows"
];

async function getRadarrTags() {
  const { data } = await axios.get(
    `${RADARR_URL}/api/v3/tag`,
    {
      headers: {
        "X-Api-Key": RADARR_API_KEY
      }
    }
  );

  return data;
}

async function getSonarrTags() {
  const { data } = await axios.get(
    `${SONARR_URL}/api/v3/tag`,
    {
      headers: {
        "X-Api-Key": SONARR_API_KEY
      }
    }
  );

  return data;
}

async function ensureRadarrTags() {

  const existing = await getRadarrTags();

  const ids = [];

  for (const label of MOVIE_TAGS) {

    let tag = existing.find(
      t => t.label.toLowerCase() === label.toLowerCase()
    );

    if (!tag) {

      const { data } = await axios.post(
        `${RADARR_URL}/api/v3/tag`,
        { label },
        {
          headers: {
            "X-Api-Key": RADARR_API_KEY
          }
        }
      );

      tag = data;
    }

    ids.push(tag.id);
  }

  return ids;
}

async function ensureSonarrTags() {

  const existing = await getSonarrTags();

  const ids = [];

  for (const label of SHOW_TAGS) {

    let tag = existing.find(
      t => t.label.toLowerCase() === label.toLowerCase()
    );

    if (!tag) {

      const { data } = await axios.post(
        `${SONARR_URL}/api/v3/tag`,
        { label },
        {
          headers: {
            "X-Api-Key": SONARR_API_KEY
          }
        }
      );

      tag = data;
    }

    ids.push(tag.id);
  }

  return ids;
}

async function getMovieRootFolder() {

  const { data } = await axios.get(
    `${RADARR_URL}/api/v3/rootfolder`,
    {
      headers: {
        "X-Api-Key": RADARR_API_KEY
      }
    }
  );

  return data[0].path;
}

async function getSeriesRootFolder() {

  const { data } = await axios.get(
    `${SONARR_URL}/api/v3/rootfolder`,
    {
      headers: {
        "X-Api-Key": SONARR_API_KEY
      }
    }
  );

  return data[0].path;
}

async function getRadarrQualityProfile() {

  const { data } = await axios.get(
    `${RADARR_URL}/api/v3/qualityprofile`,
    {
      headers: {
        "X-Api-Key": RADARR_API_KEY
      }
    }
  );

  return data[0].id;
}

async function getSonarrQualityProfile() {

  const { data } = await axios.get(
    `${SONARR_URL}/api/v3/qualityprofile`,
    {
      headers: {
        "X-Api-Key": SONARR_API_KEY
      }
    }
  );

  return data[0].id;
}

export async function sendToArr() {
  try {
    

  console.log("==================================");
  console.log("🚀 Arr Import Started");
  console.log("==================================");

  const movieTagIds = await ensureRadarrTags();
  const showTagIds = await ensureSonarrTags();

  const movieRoot = await getMovieRootFolder();
  const showRoot = await getSeriesRootFolder();

  const movieProfile = await getRadarrQualityProfile();
  const showProfile = await getSonarrQualityProfile();

const movieResult = await pool.query(`
  SELECT *
  FROM trakt_cache tc
  WHERE tc.trakt_type = 'movie'
    AND tc.imdb_id IS NOT NULL
    AND tc.tmdb_id IS NOT NULL
    AND tc.year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1
    AND COALESCE(tc.trakt_status,'pending') <> 'added'

    -- Not in Radarr
    AND NOT EXISTS (
      SELECT 1
      FROM radarrsonarr rs
      WHERE rs.source = 'radarr'
      AND rs.removed= FALSE
        AND (
          rs.imdb_id = tc.imdb_id
          OR rs.tmdb_id = tc.tmdb_id
        )
    )

    -- Not in exclusions
    AND NOT EXISTS (
      SELECT 1
      FROM media_exclusions me
      WHERE me.source = 'radarr'
        AND me.tmdb_id = tc.tmdb_id
    )

  ORDER BY tc.id
`);

  console.log(
    `🎬 Movies to import: ${movieResult.rows.length}`
  );

  for (const movie of movieResult.rows) {

    try {

      console.log(
        `🎬 Adding Movie: ${movie.clean_title}`
      );
const tmdbId = movie.tmdb_id;



await axios.post(
  `${RADARR_URL}/api/v3/movie`,
  {
    tmdbId,
    qualityProfileId: movieProfile,
    rootFolderPath: '/data/2tb/media/English',
    monitored: false,
    tags: movieTagIds
  },
  {
    headers: {
      "X-Api-Key": RADARR_API_KEY
    }
  }
);


      await pool.query(`
        UPDATE trakt_cache
        SET trakt_status='added'
        WHERE id=$1
      `,[movie.id]);

      console.log(
        `✅ Added Movie: ${movie.clean_title}`
      );

    } catch (err) {

      console.log(
        `❌ Movie Failed: ${movie.clean_title}`
      );

      console.log(
        err.response?.data || err.message
      );
    }
  }

const showResult = await pool.query(`
  SELECT *
  FROM trakt_cache tc
  WHERE tc.trakt_type = 'tv'
    AND tc.imdb_id IS NOT NULL
    AND tc.tvdb_id IS NOT NULL
    AND COALESCE(tc.trakt_status,'pending') <> 'added'

    -- Not in Sonarr
    AND NOT EXISTS (
      SELECT 1
      FROM radarrsonarr rs
      WHERE rs.source = 'sonarr'
      AND rs.removed = FALSE
        AND (
          rs.imdb_id = tc.imdb_id
          OR rs.tvdb_id = tc.tvdb_id
        )
    )

    -- Not in exclusions
    AND NOT EXISTS (
      SELECT 1
      FROM media_exclusions me
      WHERE me.source = 'sonarr'
        AND me.tvdb_id = tc.tvdb_id
    )

  ORDER BY tc.id
`);

  console.log(
    `📺 Shows to import: ${showResult.rows.length}`
  );

  for (const show of showResult.rows) {

    try {

      console.log(
        `📺 Adding Show: ${show.clean_title}`
      );



await axios.post(
  `${SONARR_URL}/api/v3/series`,
  {
    tvdbId: show.tvdb_id,
    title: show.clean_title,
    qualityProfileId: showProfile,
    rootFolderPath: "/data/4tb/media/TV-English",
    monitored: false,
    monitorNewItems: "none",
    seasonFolder: true,
    tags: showTagIds,
    addOptions: {
      searchForMissingEpisodes: false,
      monitor: "none"
    }
  },
  {
    headers: {
      "X-Api-Key": SONARR_API_KEY
    }
  }
);

      // await pool.query(`
      //   UPDATE trakt_cache
      //   SET trakt_status='added'
      //   WHERE id=$1
      // `,[show.id]);

      console.log(
        `✅ Added Show: ${show.clean_title}`
      );

    } catch (err) {

      console.log(
        `❌ Show Failed: ${show.clean_title}`
      );

      // console.log(
      //   err.response?.data || err.message
      // );
    }
  }

  console.log("==================================");
  console.log("🏁 Arr Import Completed");
  console.log("==================================");

  } catch (error) {
    console.log(error)
  }
}