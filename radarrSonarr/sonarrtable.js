import { syncSonarrSeries } from "./syncSonarrSeries.js";
import { syncSonarrSeasons } from "./syncSonarrSeasons.js";
import { syncSonarrEpisodes } from "./syncSonarrEpisodes.js";
import { syncSonarrEpisodeFiles } from "./syncSonarrEpisodeFiles.js";


export async function sonarrTable(){
// await syncSonarrSeries();
await syncSonarrSeasons();
await  syncSonarrEpisodes();
await syncSonarrEpisodeFiles();

}