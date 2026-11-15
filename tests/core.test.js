const test = require("node:test");
const assert = require("node:assert/strict");
const Core = require("../src/core.js");

function game(title, extra = {}) {
  return { title, platforms: ["Steam"], status: "Backlog", ...extra };
}

test("adds and updates a game while keeping its stable identifier", () => {
  const added = Core.addGame(Core.emptyState(), game("Outer Wilds", { playtimeMinutes: 45 }));
  assert.equal(added.state.games.length, 1);
  assert.equal(added.state.games[0].playtimeMinutes, 45);
  const updated = Core.updateGame(added.state, added.game.id, { status: "Playing", progress: 25 });
  assert.equal(updated.game.id, added.game.id);
  assert.equal(updated.game.status, "Playing");
  assert.equal(updated.game.progress, 25);
});

test("rejects a missing title and clamps unsafe field ranges", () => {
  assert.throws(() => Core.addGame(Core.emptyState(), game("   ")), /title is required/i);
  const normalized = Core.normalizeGame(game("  A very long game  ", {
    playtimeMinutes: -20,
    progress: 150,
    priority: 99,
    rating: 8,
    achievementEarned: 100,
    achievementTotal: 10,
    coverUrl: "javascript:alert(1)"
  }));
  assert.equal(normalized.title, "A very long game");
  assert.equal(normalized.playtimeMinutes, 0);
  assert.equal(normalized.progress, 100);
  assert.equal(normalized.priority, 5);
  assert.equal(normalized.rating, 5);
  assert.equal(normalized.achievementEarned, 10);
  assert.equal(normalized.coverUrl, "");
});

test("search, status, and platform filters compose and sort", () => {
  const games = [
    Core.normalizeGame(game("Hades", { genre: "Roguelike", status: "Playing", playtimeMinutes: 120 })),
    Core.normalizeGame(game("Celeste", { platforms: ["Nintendo Switch"], status: "Completed", playtimeMinutes: 600 })),
    Core.normalizeGame(game("Hollow Knight", { platforms: ["Steam"], status: "Backlog", playtimeMinutes: 30 }))
  ];
  assert.deepEqual(Core.filterGames(games, { query: "rogue", status: "Playing" }).map((item) => item.title), ["Hades"]);
  assert.deepEqual(Core.filterGames(games, { platform: "Steam", sort: "playtime" }).map((item) => item.title), ["Hades", "Hollow Knight"]);
  assert.deepEqual(Core.filterGames(games, { status: "Completed" }).map((item) => item.title), ["Celeste"]);
});

test("calculates stats from recorded games without inventing playtime", () => {
  const state = Core.normalizeState({
    games: [
      game("A", { status: "Completed", playtimeMinutes: 90, achievementEarned: 4, achievementTotal: 10 }),
      game("B", { status: "Playing", playtimeMinutes: 0, achievementEarned: 1, achievementTotal: 2 }),
      game("C", { status: "Wishlist", ownership: "Wishlist" })
    ]
  });
  assert.deepEqual(Core.getStats(state), {
    totalGames: 3, playing: 1, completed: 1, backlog: 0, wishlist: 1,
    totalPlaytimeMinutes: 90, completionPercent: 33,
    achievementEarned: 5, achievementTotal: 12, achievementPercent: 42
  });
});

test("CSV export and import preserve commas, quotes, and multiple platforms", () => {
  const source = Core.normalizeGame(game('The "Great", Adventure', {
    platforms: ["Steam", "Nintendo Switch"],
    notes: "Line one, line two"
  }));
  const csv = Core.toCsv([source]);
  const [restored] = Core.parseCsv(csv);
  assert.equal(restored.title, source.title);
  assert.deepEqual(restored.platforms, source.platforms);
  assert.equal(restored.notes, source.notes);
});

test("import preview skips duplicates without overwriting existing games", () => {
  const original = Core.addGame(Core.emptyState(), game("Hades", { status: "Playing", playtimeMinutes: 321 }));
  const result = Core.mergeImport(original.state, [
    game("hades", { status: "Completed", playtimeMinutes: 999 }),
    game("Celeste", { platforms: ["Nintendo Switch"] }),
    game("Celeste", { platforms: ["Nintendo Switch"] })
  ]);
  assert.equal(result.additions.length, 1);
  assert.equal(result.duplicates.length, 2);
  assert.equal(result.state.games.find((item) => item.id === original.game.id).status, "Playing");
  assert.equal(result.state.games.find((item) => item.title === "Celeste").title, "Celeste");
});

test("JSON backup import restores sessions and profile only into an empty library", () => {
  const record = { ...game("Backup game"), id: "backup-game-id" };
  const backup = {
    profile: { name: "Riley", theme: "light" },
    platforms: [{ name: "Playdate", group: "Handheld", custom: true }],
    sessions: [{ id: "backup-session", gameId: record.id, durationMinutes: 45 }],
    activeSession: { gameId: record.id, startedAt: "2025-01-01T10:00:00.000Z" }
  };
  const restored = Core.mergeImport(Core.emptyState(), [record], backup);
  assert.equal(restored.state.profile.name, "Riley");
  assert.equal(restored.state.profile.theme, "light");
  assert.equal(restored.state.platforms.some((platform) => platform.name === "Playdate"), true);
  assert.equal(restored.state.sessions.length, 1);
  assert.equal(restored.state.activeSession.gameId, record.id);

  const existing = Core.addGame(Core.emptyState(), game("Already here"));
  existing.state.profile.name = "My profile";
  const merged = Core.mergeImport(existing.state, [record], backup);
  assert.equal(merged.state.profile.name, "My profile");
  assert.equal(merged.state.sessions.length, 1);
  assert.equal(merged.state.activeSession, null);
});

test("deleting a game also removes its sessions and active timer", () => {
  const added = Core.addGame(Core.emptyState(), game("A"));
  const state = { ...added.state, sessions: [{ gameId: added.game.id, durationMinutes: 20 }], activeSession: { gameId: added.game.id, startedAt: new Date().toISOString() } };
  const result = Core.deleteGame(state, added.game.id);
  assert.equal(result.games.length, 0);
  assert.equal(result.sessions.length, 0);
  assert.equal(result.activeSession, null);
});

test("requires HTTPS artwork URLs", () => {
  assert.equal(Core.safeCoverUrl("https://example.com/cover.jpg"), "https://example.com/cover.jpg");
  assert.equal(Core.safeCoverUrl("http://example.com/cover.jpg"), "");
  assert.equal(Core.safeCoverUrl("data:image/svg+xml,<svg/>"), "");
});

test("rejects malformed or header-only CSV files", () => {
  assert.throws(() => Core.parseCsv("developer,platform\nStudio,PC"), /title/);
  assert.throws(() => Core.parseCsv("title"), /header row/i);
});
