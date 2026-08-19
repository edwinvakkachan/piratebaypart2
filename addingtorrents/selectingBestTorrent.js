

function getQualityScore(title) {
  const match = title?.match(/\b(2160p|4K|1080p|1440p|720p|576p|480p|360p)\b/i);

  if (!match) return 0;

  const quality = match[1].toLowerCase();

  if (quality === "4k") return 2160;

  return Number.parseInt(quality.replace("p", ""), 10) || 0;
}


export async function selectBestTorrent(torrents) {
  if (!torrents || torrents.length === 0) {
    return null;
  }

  return [...torrents].sort((a, b) => {
    // 1. Higher quality first
    const qualityA = getQualityScore(a.title);
    const qualityB = getQualityScore(b.title);

    if (qualityA !== qualityB) {
      return qualityB - qualityA;
    }

    // 2. More seeders first
    const seedersA = Number(a.seeders) || 0;
    const seedersB = Number(b.seeders) || 0;

    if (seedersA !== seedersB) {
      return seedersB - seedersA;
    }

    // 3. Larger file first
    const sizeA = Number(a.size) || 0;
    const sizeB = Number(b.size) || 0;

    if (sizeA !== sizeB) {
      return sizeB - sizeA;
    }

    // 4. Newer torrent first
    return new Date(b.created_at) - new Date(a.created_at);
  })[0];
}