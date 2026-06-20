import "dotenv/config";
import { scrapePirateBayMovieMagnets } from "./extractHomePage.js";
import { addToTorrent  } from "./addTOTorrent.js";
import { delay } from "./delay.js";
import { deleteLargePirateBayTorrents } from "./qbittorrent/torrentCleanUp.js";
import {
  triggerHomeAssistantWebhook,
  triggerHomeAssistantWebhookWhenErrorOccurs
} from "./homeassistant/homeAssistantWebhook.js";
import { log } from "./timelog.js";
import { retry } from "./homeassistant/retryWrapper.js";
import { publishMessage } from "./queue/publishMessage.js";
import { initDB } from "./db/db.js";
import { saveMagnets } from "./db/saveMagnets.js";
import { isQBittorrentAvailable } from "./qbittorrent/qb.js";
import { yts,updateYtsRunTime,shouldRunYts } from "./yts/yts.js";
import { eztv } from "./eztv/eztv.js";
import { buildTraktCache } from "./traktv/traktv.js";
import { radarrsonarr } from "./radarrSonarr/radarrsonarrsync.js";
import { sendMissingRadarrToQbit,sendMissingSonarrToQbit } from "./addingtorrents/radarrSonarrToQbit.js";
import { sendToArr } from "./addToArr.js";
import { piratebayTv,piratebaymovie } from "./piratebay/piratebay.js";
import { populateMetadataFromOMDb } from "./omdb/populateMetadataFromOMDb.js";
import { checkRadarr, checkSonarr } from "./radarrSonarravailabilitycheck.js";
import { syncMediaExclusions } from "./addingtorrents/syncMediaExclusions.js";
import { updateTmdbIdsForRadarr,updateTvdbIdsForSonarr } from "./metadata/updateTmdbFromTraktCache.js";
import { sonarrTable } from "./radarrSonarr/sonarrtable.js";
import { extractEpisodeAndSeasonDetails } from "./addingtorrents/extractEpisodeAndSeasonDetails.js.js";
async function main() {
  try {
    await log();

    console.log("Pirate Bay movie scraping process started");
    await publishMessage({
      message: "Pirate Bay movie scraping process started"
    });

    await initDB();
    console.log("db is ready");


   
  const isRadarrAvailable = await checkRadarr();
  const isSonarrAvailable = await checkSonarr();

  if(isRadarrAvailable && isSonarrAvailable) {
    await updateTmdbIdsForRadarr();
      await delay(1000,true);
    await updateTvdbIdsForSonarr();
  }

// const shouldRun =await shouldRunYts()

  const isRadarrAvailableagain = await checkRadarr();
  const isSonarrAvailableagain = await checkSonarr();


  if(isRadarrAvailableagain && isSonarrAvailableagain) {
//      if (shouldRun) {
//       console.log('Running mediaexclustion table creation sync...');
//  await syncMediaExclusions();
//  await updateYtsRunTime();
//   await delay(1000,true);
//   }

    await radarrsonarr(); 
      await delay(1000,true);
    await sendToArr();
      await delay(1000,true);
    await sonarrTable();
    
  }
  
  
  const result = await isQBittorrentAvailable();
  if(result){
  await sendMissingRadarrToQbit();
  await sendMissingSonarrToQbit();
  
    }



    await publishMessage({
      message: "Pirate Bay movie scraping completed successfully"
    });



    await log();
  } catch (error) {
    console.error("Fatal error in main():");
    console.error(error);

    await publishMessage({
      message: "Fatal error in main()"
    });

    await retry(
      triggerHomeAssistantWebhookWhenErrorOccurs,
      { status: "error" },
      "homeassistant-error",
      5
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unhandled error:", err);
    process.exit(1);
  });
