function getSonarrQualityScore(title) {
  const match = title?.match(
    /\b(2160p|4K|1080p|1440p|720p|576p|480p|360p)\b/i
  );

  if (!match) return 0;

  const quality = match[1].toLowerCase();

  if (quality === "4k") return 2160;

  return Number.parseInt(quality.replace("p", ""), 10) || 0;
}


function getSonarrSourceScore(title) {
  const t = (title || "").toLowerCase();

  // Prefer WEB-DL over WEB and HDTV
  if (/\bweb[- .]?dl\b/.test(t)) return 300;
  if (/\bweb\b/.test(t)) return 250;
  if (/\bhdtv\b/.test(t)) return 200;
  if (/\bbluray\b|\bbdrip\b/.test(t)) return 350;

  return 0;
}


function getSonarrCodecScore(title) {
  const t = (title || "").toLowerCase();

  // HEVC / x265
  if (
    /\bhevc\b/.test(t) ||
    /\bx265\b/.test(t) ||
    /\bh\.?265\b/.test(t)
  ) {
    return 200;
  }

  // H264 / x264
  if (
    /\bx264\b/.test(t) ||
    /\bh\.?264\b/.test(t)
  ) {
    return 150;
  }

  // XviD
  if (/\bxvid\b/.test(t)) {
    return 50;
  }

  return 0;
}


function getSonarrReleaseScore(title) {
  const t = (title || "").toLowerCase();

  let score = 0;

  // Repack / proper releases are generally preferable
  if (/\brepack\b/.test(t)) {
    score += 50;
  }

  if (/\bproper\b/.test(t)) {
    score += 50;
  }

  // Avoid obvious low-quality releases
  if (/\bcam\b|\bts\b|\btelesync\b|\btelecine\b/.test(t)) {
    score -= 500;
  }

  return score;
}


export async function selectBestSonarrTorrent(torrents) {
  if (!Array.isArray(torrents) || torrents.length === 0) {
    return null;
  }

  return [...torrents].sort((a, b) => {

    const titleA = a.title || "";
    const titleB = b.title || "";

    // --------------------------------------------------
    // 1. QUALITY
    // --------------------------------------------------

    const qualityA = getSonarrQualityScore(titleA);
    const qualityB = getSonarrQualityScore(titleB);

    if (qualityA !== qualityB) {
      return qualityB - qualityA;
    }


    // --------------------------------------------------
    // 2. SOURCE
    // --------------------------------------------------

    const sourceA = getSonarrSourceScore(titleA);
    const sourceB = getSonarrSourceScore(titleB);

    if (sourceA !== sourceB) {
      return sourceB - sourceA;
    }


    // --------------------------------------------------
    // 3. CODEC
    // --------------------------------------------------

    const codecA = getSonarrCodecScore(titleA);
    const codecB = getSonarrCodecScore(titleB);

    if (codecA !== codecB) {
      return codecB - codecA;
    }


    // --------------------------------------------------
    // 4. REPACK / PROPER / BAD RELEASE
    // --------------------------------------------------

    const releaseA = getSonarrReleaseScore(titleA);
    const releaseB = getSonarrReleaseScore(titleB);

    if (releaseA !== releaseB) {
      return releaseB - releaseA;
    }


    // --------------------------------------------------
    // 5. SEEDERS
    // --------------------------------------------------

    const seedersA = Number(a.seeders) || 0;
    const seedersB = Number(b.seeders) || 0;

    if (seedersA !== seedersB) {
      return seedersB - seedersA;
    }


    // --------------------------------------------------
    // 6. FILE SIZE
    // --------------------------------------------------

    const sizeA = Number(a.size) || 0;
    const sizeB = Number(b.size) || 0;

    if (sizeA !== sizeB) {
      return sizeB - sizeA;
    }


    // --------------------------------------------------
    // 7. NEWER RELEASE
    // --------------------------------------------------

    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();

    return dateB - dateA;
  })[0];
}