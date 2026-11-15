(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  if (root) root.GameVerseCore = core;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STATUSES = [
    "Not started", "Backlog", "Playing", "Paused", "Completed",
    "100% completed", "Abandoned", "Replay planned", "Currently replaying",
    "Wishlist", "Unplayed", "Archived"
  ];

  const PLATFORM_GROUPS = [
    { name: "PC & launchers", platforms: ["PC", "Steam", "Epic Games Store", "GOG", "Xbox PC", "EA app", "Ubisoft Connect", "Battle.net", "itch.io", "Amazon Games", "Riot Games", "Rockstar Games Launcher", "Linux", "macOS", "Steam Deck", "ROG Ally", "Legion Go"] },
    { name: "PlayStation", platforms: ["PlayStation", "PlayStation 5", "PlayStation 4", "PlayStation 3", "PlayStation 2", "PlayStation", "PSP", "PlayStation Vita", "PlayStation VR", "PlayStation VR2"] },
    { name: "Xbox", platforms: ["Xbox Series X|S", "Xbox One", "Xbox 360", "Original Xbox", "Xbox Cloud Gaming", "Xbox Game Pass"] },
    { name: "Nintendo", platforms: ["Nintendo Switch 2", "Nintendo Switch", "Wii U", "Wii", "GameCube", "Nintendo 64", "SNES", "NES", "Game Boy Advance", "Game Boy Color", "Game Boy", "Nintendo DS", "Nintendo 3DS", "Virtual Boy"] },
    { name: "Other consoles & retro", platforms: ["Sega Dreamcast", "Sega Saturn", "Sega Genesis", "Sega Game Gear", "Sega Master System", "Atari", "Commodore 64", "Neo Geo", "TurboGrafx-16", "3DO", "MS-DOS", "Arcade"] },
    { name: "Mobile, VR & cloud", platforms: ["Android", "iOS", "Meta Quest", "PC VR", "Apple Vision Pro", "GeForce NOW", "Amazon Luna"] }
  ];

  const DEFAULT_PLATFORMS = PLATFORM_GROUPS.flatMap((group) =>
    [...new Set(group.platforms)].map((name) => ({ id: slug(name), name, group: group.name, custom: false }))
  );

  function slug(value) {
    return String(value || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function createId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `gv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function emptyState() {
    return {
      version: 1,
      profile: { name: "Gamer", theme: "dark" },
      platforms: DEFAULT_PLATFORMS.map((platform) => ({ ...platform })),
      games: [],
      sessions: [],
      activeSession: null
    };
  }

  function normalizeState(input) {
    const state = emptyState();
    if (!input || typeof input !== "object") return state;
    state.profile = {
      name: cleanString(input.profile?.name, 40) || "Gamer",
      theme: input.profile?.theme === "light" ? "light" : "dark"
    };
    const customPlatforms = Array.isArray(input.platforms)
      ? input.platforms.filter((platform) => platform && typeof platform.name === "string")
      : [];
    const platformMap = new Map(state.platforms.map((platform) => [platform.name.toLowerCase(), platform]));
    for (const platform of customPlatforms) {
      const key = platform.name.trim().toLowerCase();
      if (key && !platformMap.has(key)) {
        const normalized = { id: slug(platform.id || platform.name) || createId(), name: cleanString(platform.name, 50), group: cleanString(platform.group, 50) || "Custom platforms", custom: Boolean(platform.custom) };
        platformMap.set(key, normalized);
      }
    }
    state.platforms = [...platformMap.values()];
    state.games = Array.isArray(input.games) ? input.games.map(normalizeGame).filter(Boolean) : [];
    state.sessions = Array.isArray(input.sessions) ? input.sessions.map(normalizeSession).filter(Boolean) : [];
    state.activeSession = normalizeActiveSession(input.activeSession);
    return state;
  }

  function cleanString(value, maxLength) {
    return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
  }

  function numberInRange(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeGame(input) {
    if (!input || typeof input !== "object") return null;
    const title = cleanString(input.title, 120);
    if (!title) return null;
    const platforms = Array.isArray(input.platforms)
      ? input.platforms.map((platform) => cleanString(platform, 50)).filter(Boolean).slice(0, 12)
      : [];
    if (!platforms.length && cleanString(input.platform, 50)) platforms.push(cleanString(input.platform, 50));
    const validStatus = STATUSES.includes(input.status) ? input.status : "Backlog";
    const coverUrl = safeCoverUrl(input.coverUrl);
    const rating = input.rating === "" || input.rating == null ? null : numberInRange(input.rating, 1, 5, null);
    const achievementTotal = numberInRange(input.achievementTotal, 0, 100000, 0);
    const achievementEarned = numberInRange(input.achievementEarned, 0, achievementTotal, 0);
    return {
      id: cleanString(input.id, 80) || createId(),
      title,
      developer: cleanString(input.developer, 100),
      genre: cleanString(input.genre, 50),
      platforms: [...new Set(platforms)],
      status: validStatus,
      ownership: ["Owned", "Subscription", "Wishlist", "Not owned"].includes(input.ownership) ? input.ownership : "Owned",
      playtimeMinutes: Math.round(numberInRange(input.playtimeMinutes, 0, 100000000, 0)),
      progress: Math.round(numberInRange(input.progress, 0, 100, 0)),
      rating,
      priority: Math.round(numberInRange(input.priority, 1, 5, 3)),
      releaseYear: input.releaseYear ? Math.round(numberInRange(input.releaseYear, 1950, new Date().getFullYear() + 10, 0)) || null : null,
      estimatedHours: input.estimatedHours ? numberInRange(input.estimatedHours, 0, 100000, 0) || null : null,
      achievementEarned,
      achievementTotal,
      coverUrl,
      notes: cleanString(input.notes, 2000),
      createdAt: cleanString(input.createdAt, 40) || new Date().toISOString(),
      updatedAt: cleanString(input.updatedAt, 40) || new Date().toISOString()
    };
  }

  function safeCoverUrl(value) {
    const url = cleanString(value, 500);
    if (!url) return "";
    try {
      return new URL(url).protocol === "https:" ? url : "";
    } catch {
      return "";
    }
  }

  function normalizeSession(input) {
    if (!input || typeof input !== "object") return null;
    const gameId = cleanString(input.gameId, 80);
    const durationMinutes = Math.round(numberInRange(input.durationMinutes, 1, 1000000, 0));
    if (!gameId || !durationMinutes) return null;
    return {
      id: cleanString(input.id, 80) || createId(),
      gameId,
      platform: cleanString(input.platform, 50),
      startedAt: cleanString(input.startedAt, 40) || new Date().toISOString(),
      durationMinutes,
      notes: cleanString(input.notes, 500)
    };
  }

  function normalizeActiveSession(input) {
    if (!input || !input.gameId || !Number.isFinite(Date.parse(input.startedAt))) return null;
    return {
      gameId: cleanString(input.gameId, 80),
      platform: cleanString(input.platform, 50),
      startedAt: new Date(input.startedAt).toISOString()
    };
  }

  function addGame(state, input) {
    const game = normalizeGame(input);
    if (!game) throw new Error("A game title is required.");
    const next = normalizeState(state);
    next.games.unshift(game);
    for (const name of game.platforms) ensurePlatform(next, name);
    return { state: next, game };
  }

  function updateGame(state, id, input) {
    const next = normalizeState(state);
    const index = next.games.findIndex((game) => game.id === id);
    if (index < 0) throw new Error("That game is no longer in your library.");
    const updated = normalizeGame({ ...next.games[index], ...input, id, createdAt: next.games[index].createdAt });
    if (!updated) throw new Error("A game title is required.");
    updated.updatedAt = new Date().toISOString();
    next.games[index] = updated;
    updated.platforms.forEach((name) => ensurePlatform(next, name));
    return { state: next, game: updated };
  }

  function ensurePlatform(state, name) {
    if (!name || state.platforms.some((platform) => platform.name.toLowerCase() === name.toLowerCase())) return;
    state.platforms.push({ id: slug(name) || createId(), name: cleanString(name, 50), group: "Custom platforms", custom: true });
  }

  function deleteGame(state, id) {
    const next = normalizeState(state);
    next.games = next.games.filter((game) => game.id !== id);
    next.sessions = next.sessions.filter((session) => session.gameId !== id);
    if (next.activeSession?.gameId === id) next.activeSession = null;
    return next;
  }

  function matchesFilters(game, filters) {
    const query = String(filters.query || "").trim().toLowerCase();
    const matchesQuery = !query || [game.title, game.developer, game.genre, ...game.platforms].join(" ").toLowerCase().includes(query);
    const matchesStatus = !filters.status || game.status === filters.status;
    const matchesPlatform = !filters.platform || game.platforms.includes(filters.platform);
    const matchesGenre = !filters.genre || game.genre === filters.genre;
    return matchesQuery && matchesStatus && matchesPlatform && matchesGenre;
  }

  function filterGames(games, filters = {}) {
    const result = games.filter((game) => matchesFilters(game, filters));
    const sorters = {
      title: (a, b) => a.title.localeCompare(b.title),
      playtime: (a, b) => b.playtimeMinutes - a.playtimeMinutes,
      rating: (a, b) => (b.rating || 0) - (a.rating || 0),
      recentlyAdded: (a, b) => b.createdAt.localeCompare(a.createdAt),
      priority: (a, b) => b.priority - a.priority
    };
    return result.sort(sorters[filters.sort] || sorters.recentlyAdded);
  }

  function getStats(state) {
    const games = state.games;
    const complete = games.filter((game) => ["Completed", "100% completed"].includes(game.status)).length;
    const earned = games.reduce((sum, game) => sum + game.achievementEarned, 0);
    const available = games.reduce((sum, game) => sum + game.achievementTotal, 0);
    return {
      totalGames: games.length,
      playing: games.filter((game) => ["Playing", "Currently replaying"].includes(game.status)).length,
      completed: complete,
      backlog: games.filter((game) => ["Backlog", "Not started", "Unplayed"].includes(game.status)).length,
      wishlist: games.filter((game) => game.status === "Wishlist" || game.ownership === "Wishlist").length,
      totalPlaytimeMinutes: games.reduce((sum, game) => sum + game.playtimeMinutes, 0),
      completionPercent: games.length ? Math.round((complete / games.length) * 100) : 0,
      achievementEarned: earned,
      achievementTotal: available,
      achievementPercent: available ? Math.round((earned / available) * 100) : 0
    };
  }

  function formatPlaytime(minutes) {
    const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
    const hours = Math.floor(safeMinutes / 60);
    const remainder = safeMinutes % 60;
    if (hours >= 1000) return `${(hours / 1000).toFixed(hours >= 10000 ? 0 : 1)}k hrs`;
    if (hours === 0) return `${remainder}m`;
    return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  }

  function sameGame(a, b) {
    const titleA = String(a.title || "").trim().toLowerCase();
    const titleB = String(b.title || "").trim().toLowerCase();
    const platformsA = new Set((a.platforms || []).map((name) => name.toLowerCase()));
    return titleA === titleB && (b.platforms || []).some((name) => platformsA.has(name.toLowerCase()));
  }

  function toCsv(games) {
    const columns = ["title", "developer", "genre", "platforms", "status", "ownership", "playtimeMinutes", "progress", "rating", "priority", "releaseYear", "estimatedHours", "achievementEarned", "achievementTotal", "coverUrl", "notes"];
    const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    return [columns.join(","), ...games.map((game) => columns.map((key) => quote(key === "platforms" ? game.platforms.join("; ") : game[key])).join(","))].join("\r\n");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    const input = String(text).replace(/^\uFEFF/, "");
    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (quoted) {
        if (char === '"' && input[i + 1] === '"') { value += '"'; i += 1; }
        else if (char === '"') quoted = false;
        else value += char;
      } else if (char === '"' && value === "") quoted = true;
      else if (char === ",") { row.push(value); value = ""; }
      else if (char === "\n" || char === "\r") {
        row.push(value); value = "";
        if (row.some((cell) => cell.trim())) rows.push(row);
        row = [];
        if (char === "\r" && input[i + 1] === "\n") i += 1;
      } else value += char;
    }
    row.push(value);
    if (row.some((cell) => cell.trim())) rows.push(row);
    if (rows.length < 2) throw new Error("The CSV must include a header row and at least one game.");
    const headers = rows[0].map((header) => header.trim());
    if (!headers.includes("title")) throw new Error('The CSV needs a "title" column.');
    return rows.slice(1).map((cells) => {
      const record = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]));
      record.platforms = String(record.platforms || record.platform || "").split(/[;|]/).map((name) => name.trim()).filter(Boolean);
      for (const key of ["playtimeMinutes", "progress", "priority", "releaseYear", "estimatedHours", "achievementEarned", "achievementTotal"]) {
        if (record[key] === "") delete record[key];
        else record[key] = Number(record[key]);
      }
      if (record.rating === "") delete record.rating;
      else if (record.rating != null) record.rating = Number(record.rating);
      return record;
    }).filter((record) => record.title.trim());
  }

  function previewImport(state, records) {
    const seen = [];
    const additions = [];
    const duplicates = [];
    for (const record of records) {
      const game = normalizeGame(record);
      if (!game) continue;
      if (state.games.some((existing) => sameGame(existing, game)) || seen.some((existing) => sameGame(existing, game))) duplicates.push(game.title);
      else { additions.push(game); seen.push(game); }
    }
    return { additions, duplicates, invalid: records.length - additions.length - duplicates.length };
  }

  function mergeImport(state, records, backup = null) {
    const next = normalizeState(state);
    const restoreProfile = next.games.length === 0;
    const preview = previewImport(next, records);
    next.games = [...preview.additions, ...next.games];
    if (backup && Array.isArray(backup.platforms)) {
      next.platforms = normalizeState({ ...next, platforms: [...next.platforms, ...backup.platforms] }).platforms;
    }
    next.games.forEach((game) => game.platforms.forEach((name) => ensurePlatform(next, name)));
    const newGameIds = new Set(preview.additions.map((game) => game.id));
    const existingSessionIds = new Set(next.sessions.map((session) => session.id));
    let importedSessions = 0;
    if (backup && Array.isArray(backup.sessions)) {
      for (const rawSession of backup.sessions) {
        const session = normalizeSession(rawSession);
        if (session && newGameIds.has(session.gameId) && !existingSessionIds.has(session.id)) {
          next.sessions.push(session);
          existingSessionIds.add(session.id);
          importedSessions += 1;
        }
      }
    }
    if (restoreProfile && backup?.profile) {
      next.profile = {
        name: cleanString(backup.profile.name, 40) || "Gamer",
        theme: backup.profile.theme === "light" ? "light" : "dark"
      };
    }
    if (restoreProfile && !next.activeSession && backup?.activeSession && newGameIds.has(backup.activeSession.gameId)) {
      next.activeSession = normalizeActiveSession(backup.activeSession);
    }
    return { state: next, ...preview, importedSessions };
  }

  return {
    STATUSES, PLATFORM_GROUPS, DEFAULT_PLATFORMS,
    emptyState, normalizeState, normalizeGame, normalizeSession, addGame, updateGame, deleteGame,
    filterGames, getStats, formatPlaytime, parseCsv, toCsv, previewImport, mergeImport,
    safeCoverUrl, createId
  };
});
