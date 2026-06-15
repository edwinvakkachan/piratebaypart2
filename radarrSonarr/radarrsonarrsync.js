import axios from "axios";
import pool from "../db/pool.js";


 async function getRadarrMovies() {
  const response = await axios.get(
    `${process.env.RADARR_URL}/api/v3/movie`,
    {
      headers: {
        "X-Api-Key": process.env.RADARR_API_KEY
      }
    }
  );

  return response.data;
}



 async function getSonarrSeries() {
  const response = await axios.get(
    `${process.env.SONARR_URL}/api/v3/series`,
    {
      headers: {
        "X-Api-Key": process.env.SONARR_API_KEY
      }
    }
  );

  return response.data;
}

async function getRadarrTags() {
  const response = await axios.get(
    `${process.env.RADARR_URL}/api/v3/tag`,
    {
      headers: {
        "X-Api-Key": process.env.RADARR_API_KEY
      }
    }
  );

  return response.data;
}

async function getSonarrTags() {
  const response = await axios.get(
    `${process.env.SONARR_URL}/api/v3/tag`,
    {
      headers: {
        "X-Api-Key": process.env.SONARR_API_KEY
      }
    }
  );

  return response.data;
}

export async function radarrsonarr(){
    try {
        
     console.log("🚀 Radarr/Sonarr sync started");

const radarrTags = await getRadarrTags();
const sonarrTags = await getSonarrTags();

const radarrTagMap = {};
const sonarrTagMap = {};

for (const tag of radarrTags) {
  radarrTagMap[tag.id] = tag.label;
}

for (const tag of sonarrTags) {
  sonarrTagMap[tag.id] = tag.label;
}


     await pool.query(`
  UPDATE radarrSonarr
  SET removed = TRUE
`);

    const movies = await getRadarrMovies();
     console.log(
      `🎬 Found ${movies.length} Radarr movies`
    );
    for (const movie of movies) {

const tagNames =
  movie.tags?.map(id => radarrTagMap[id])
             .filter(Boolean) || [];

await pool.query(`
 INSERT INTO radarrsonarr (
  source,
  external_id,
  title,
  year,
  imdb_id,
  tmdb_id,
  monitored,
  status,
  path,
  quality_profile_id,
  root_folder_path,
  size_on_disk,
  added,
  tag_names,
  removed,
  last_seen,
  updated_at
)
VALUES (
  'radarr',
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT (source, external_id)
DO UPDATE SET
  title = EXCLUDED.title,
  year = EXCLUDED.year,
  imdb_id = EXCLUDED.imdb_id,
  tmdb_id = EXCLUDED.tmdb_id,
  monitored = EXCLUDED.monitored,
  status = EXCLUDED.status,
  path = EXCLUDED.path,
  quality_profile_id = EXCLUDED.quality_profile_id,
  root_folder_path = EXCLUDED.root_folder_path,
  size_on_disk = EXCLUDED.size_on_disk,
  added = EXCLUDED.added,
  tag_names = EXCLUDED.tag_names,
  removed = FALSE,
  last_seen = NOW(),
  updated_at = NOW();
`, [
  movie.id,
  movie.title,
  movie.year,
  movie.imdbId,
  movie.tmdbId,
  movie.monitored,
  movie.status,
  movie.path,
  movie.qualityProfileId,
  movie.rootFolderPath,
  movie.sizeOnDisk,
  movie.added,
  tagNames
]);
}

const shows = await getSonarrSeries();
 console.log(
      `📺 Found ${shows.length} Sonarr series`
    );
for (const show of shows) {

  const tagNames =
  show.tags?.map(id => sonarrTagMap[id])
            .filter(Boolean) || [];

await pool.query(`
  INSERT INTO radarrsonarr (
  source,
  external_id,
  title,
  year,
  imdb_id,
  tvdb_id,
  monitored,
  status,
  path,
  quality_profile_id,
  root_folder_path,
  added,
  tag_names,
  removed,
  last_seen,
  updated_at
)
VALUES (
  'sonarr',
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
  FALSE,
  NOW(),
  NOW()
)
ON CONFLICT (source, external_id)
DO UPDATE SET
  title = EXCLUDED.title,
  year = EXCLUDED.year,
  imdb_id = EXCLUDED.imdb_id,
  tvdb_id = EXCLUDED.tvdb_id,
  monitored = EXCLUDED.monitored,
  status = EXCLUDED.status,
  path = EXCLUDED.path,
  quality_profile_id = EXCLUDED.quality_profile_id,
  root_folder_path = EXCLUDED.root_folder_path,
  added = EXCLUDED.added,
  tag_names = EXCLUDED.tag_names,
  removed = FALSE,
  last_seen = NOW(),
  updated_at = NOW();
`, [
  show.id,
  show.title,
  show.year,
  show.imdbId,
  show.tvdbId,
  show.monitored,
  show.status,
  show.path,
  show.qualityProfileId,
  show.rootFolderPath,
  show.added,
  tagNames
]);

}

    } catch (error) {
        console.error("radarr sonarr sync error:", error);
    }


 const removedCount = await pool.query(`
      SELECT COUNT(*) AS count
      FROM radarrsonarr
      WHERE removed = TRUE
    `);

    console.log(
      `🗑 Removed items detected: ${removedCount.rows[0].count}`
    );

    console.log("✅ Radarr/Sonarr sync completed");



}

