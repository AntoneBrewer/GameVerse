(function () {
  "use strict";

  const Core = window.GameVerseCore;
  const pageContent = document.getElementById("page-content");
  const modalBackdrop = document.getElementById("modal-backdrop");
  const modalContent = document.getElementById("modal-content");
  const toastRegion = document.getElementById("toast-region");
  const searchInput = document.getElementById("global-search");
  const fileInput = document.getElementById("import-file");
  const state = { data: Core.emptyState(), page: "dashboard", query: "", storageMode: "indexeddb", storagePath: "", sessionTick: null, pendingImport: null, filterStatus: "", filterPlatform: "", sort: "recentlyAdded", view: "grid" };

  const pageNames = {
    dashboard: "Dashboard", library: "My library", playing: "Currently playing", backlog: "Backlog",
    achievements: "Achievements", wishlist: "Wishlist", collections: "Collections",
    analytics: "Analytics", connections: "Connections", settings: "Settings"
  };
  const icon = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 10 6-10 6z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></svg>'
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function save() {
    state.data = Core.normalizeState(state.data);
    return window.GameVerseStorage.save(state.data, state.storageMode).catch((error) => {
      toast(error.message, "error");
      throw error;
    });
  }

  function toast(message, type = "success") {
    const node = document.createElement("div");
    node.className = `toast toast-${type}`;
    node.textContent = message;
    toastRegion.appendChild(node);
    window.setTimeout(() => node.remove(), 3600);
  }

  function setProfile() {
    const name = state.data.profile.name || "Gamer";
    document.getElementById("profile-name").textContent = name;
    document.getElementById("profile-avatar").textContent = name.charAt(0).toUpperCase();
    document.getElementById("profile-shortcut").textContent = name.charAt(0).toUpperCase();
    document.getElementById("nav-game-count").textContent = state.data.games.length;
    document.documentElement.dataset.theme = state.data.profile.theme;
  }

  function setPage(page) {
    if (!pageNames[page]) return;
    state.page = page;
    document.querySelectorAll(".nav-item[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === page));
    document.getElementById("breadcrumb-current").textContent = pageNames[page];
    document.getElementById("sidebar").classList.remove("sidebar-open");
    render();
  }

  function heading(eyebrow, title, description, actions = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
  }

  function button(label, action, className = "button button-primary", extra = "") {
    return `<button class="${className}" data-action="${action}" ${extra}>${label}</button>`;
  }

  function cover(game, extra = "") {
    const safeTitle = escapeHtml(game.title);
    const initial = escapeHtml(game.title.trim().charAt(0).toUpperCase());
    const background = game.coverUrl
      ? `<img src="${escapeHtml(game.coverUrl)}" alt="" loading="lazy" onerror="this.remove()">`
      : `<div class="cover-fallback"><span class="cover-orbit"></span><b>${initial}</b><small>GAMEVERSE</small></div>`;
    return `<div class="game-cover ${extra}">${background}<span class="cover-shade"></span><span class="cover-title">${safeTitle}</span></div>`;
  }

  function gameCard(game, index = 0) {
    const statusClass = `status-${Core.slug ? Core.slug(game.status) : game.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const platform = game.platforms[0] || "Unspecified platform";
    return `<article class="game-card" style="--card-delay:${Math.min(index, 9) * 45}ms" data-game-id="${escapeHtml(game.id)}">
      <button class="game-card-open" data-action="details" data-id="${escapeHtml(game.id)}" aria-label="View ${escapeHtml(game.title)} details">
        ${cover(game)}
        <span class="card-status ${statusClass}">${escapeHtml(game.status)}</span>
      </button>
      <div class="game-card-info">
        <div class="game-title-row"><button class="game-title-button" data-action="details" data-id="${escapeHtml(game.id)}">${escapeHtml(game.title)}</button>${game.rating ? `<span class="rating">★ ${game.rating.toFixed(1)}</span>` : ""}</div>
        <div class="game-card-meta">${escapeHtml(platform)}<span>·</span>${Core.formatPlaytime(game.playtimeMinutes)}</div>
        <div class="card-progress"><span style="width:${game.progress}%"></span></div>
      </div>
    </article>`;
  }

  function emptyState(title, message, action = true) {
    return `<div class="empty-state"><div class="empty-illustration"><span>✦</span><i></i><b></b></div><h3>${title}</h3><p>${message}</p>${action ? button(`${icon.plus} Add your first game`, "add-game") : ""}</div>`;
  }

  function statCard(label, value, note, symbol, tint) {
    return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${tint}">${symbol}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`;
  }

  function renderDashboard() {
    const stats = Core.getStats(state.data);
    const games = state.data.games;
    const recent = [...games].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4);
    const playing = games.filter((game) => ["Playing", "Currently replaying"].includes(game.status));
    const activeGame = state.data.activeSession && games.find((game) => game.id === state.data.activeSession.gameId);
    const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
    return `${heading(today, `Welcome back, ${escapeHtml(state.data.profile.name)} <span class="wave">✦</span>`, "Your whole gaming universe, in one place.", button(`${icon.plus} Add a game`, "add-game"))}
      <section class="welcome-banner">
        <div class="welcome-copy"><div class="banner-kicker"><span class="live-dot"></span> YOUR PERSONAL GAME SPACE</div><h2>Every world.<br><em>One home.</em></h2><p>Keep track of what you own, what you're playing, and what comes next.</p><div class="welcome-actions">${button(`${icon.plus} Build your library`, "add-game", "button button-lime")}${button(`Explore library ${icon.arrow}`, "page-library", "button button-quiet")}</div></div>
        <div class="banner-art" aria-hidden="true"><div class="art-glow"></div><div class="art-ring ring-one"></div><div class="art-ring ring-two"></div><div class="art-console"><span>✦</span></div><div class="art-spark spark-one">✦</div><div class="art-spark spark-two">✧</div><div class="art-orbit orbit-one"></div></div>
        <div class="banner-index">01 <span>/ 04</span></div>
      </section>
      <div class="stats-grid">
        ${statCard("Games in library", stats.totalGames, "Across your platforms", "▦", "violet")}
        ${statCard("Currently playing", stats.playing, stats.playing ? "Worlds in progress" : "Ready when you are", "◉", "lime")}
        ${statCard("Hours played", Math.floor(stats.totalPlaytimeMinutes / 60).toLocaleString(), "Manually recorded time", "◷", "blue")}
        ${statCard("Games completed", stats.completed, `${stats.completionPercent}% of your library`, "✳", "orange")}
      </div>
      ${activeGame ? `<section class="active-session-bar"><span class="live-dot"></span><div><strong>Session in progress</strong><span>${escapeHtml(activeGame.title)} · <span id="session-clock"></span></span></div>${button("End session", "stop-session", "button button-secondary")}</section>` : ""}
      <div class="section-heading"><div><div class="eyebrow">YOUR COLLECTION</div><h2>Recently updated</h2></div>${games.length ? `<button class="text-button" data-action="page-library">View all ${icon.arrow}</button>` : ""}</div>
      ${recent.length ? `<div class="game-grid">${recent.map(gameCard).join("")}</div>` : emptyState("Your next adventure starts here", "Add games to build your personal library. Your collection and playtime stay private on this device.")}
      <div class="dashboard-bottom">
        <section class="mini-panel backlog-panel"><div class="panel-heading"><div><div class="eyebrow">YOUR NEXT CHAPTER</div><h3>Backlog progress</h3></div><span class="panel-icon">◷</span></div><div class="backlog-progress-row"><div class="progress-ring" style="--progress:${stats.completionPercent * 3.6}deg"><span>${stats.completionPercent}%</span></div><div><strong>${stats.completed} of ${stats.totalGames} completed</strong><p>${stats.backlog ? `${stats.backlog} games waiting in your backlog` : "Add a game and start your backlog."}</p></div></div><button class="text-button" data-action="page-backlog">View backlog ${icon.arrow}</button></section>
        <section class="mini-panel session-panel"><div class="panel-heading"><div><div class="eyebrow">PLAY YOUR WAY</div><h3>Ready for a session?</h3></div><span class="panel-icon">◉</span></div>${playing.length ? `<p class="panel-description">Pick up where you left off.</p><div class="session-picks">${playing.slice(0, 2).map((game) => `<button class="session-pick" data-action="details" data-id="${escapeHtml(game.id)}">${cover(game, "session-cover")}<span><strong>${escapeHtml(game.title)}</strong><small>${escapeHtml(game.platforms[0] || "Game")}</small></span>${icon.arrow}</button>`).join("")}</div>` : `<p class="panel-description">Add a game and mark it as playing to keep your current adventures close at hand.</p>${button("Browse my library", "page-library", "button button-secondary")}`}</section>
      </div>`;
  }

  function libraryFilters() {
    const platforms = [...new Set(state.data.games.flatMap((game) => game.platforms))].sort();
    return `<div class="library-toolbar"><div class="filter-group"><label class="select-wrap"><span class="sr-only">Filter by status</span><select id="status-filter"><option value="">All statuses</option>${Core.STATUSES.map((status) => `<option ${state.filterStatus === status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label><label class="select-wrap"><span class="sr-only">Filter by platform</span><select id="platform-filter"><option value="">All platforms</option>${platforms.map((platform) => `<option ${state.filterPlatform === platform ? "selected" : ""}>${escapeHtml(platform)}</option>`).join("")}</select></label><label class="select-wrap"><span class="sr-only">Sort games</span><select id="sort-filter"><option value="recentlyAdded" ${state.sort === "recentlyAdded" ? "selected" : ""}>Recently updated</option><option value="title" ${state.sort === "title" ? "selected" : ""}>Title A–Z</option><option value="playtime" ${state.sort === "playtime" ? "selected" : ""}>Most played</option><option value="rating" ${state.sort === "rating" ? "selected" : ""}>Highest rated</option><option value="priority" ${state.sort === "priority" ? "selected" : ""}>Priority</option></select></label></div><div class="view-toggle"><button class="${state.view === "grid" ? "selected" : ""}" data-action="view-grid" aria-label="Grid view">▦</button><button class="${state.view === "list" ? "selected" : ""}" data-action="view-list" aria-label="List view">☷</button></div></div>`;
  }

  function renderLibrary(filterPage = "library") {
    let games = state.data.games;
    if (filterPage === "playing") games = games.filter((game) => ["Playing", "Currently replaying"].includes(game.status));
    if (filterPage === "backlog") games = games.filter((game) => ["Backlog", "Not started", "Unplayed", "Paused", "Replay planned"].includes(game.status));
    if (filterPage === "wishlist") games = games.filter((game) => game.status === "Wishlist" || game.ownership === "Wishlist");
    const filtered = Core.filterGames(games, { query: state.query, status: state.filterStatus, platform: state.filterPlatform, sort: state.sort });
    const label = { library: "EVERY ADVENTURE", playing: "IN PROGRESS", backlog: "UP NEXT", wishlist: "SOMEDAY" }[filterPage];
    const description = { library: "Your games across every platform, all in one place.", playing: "Pick up right where you left off.", backlog: "Good games don't go away. They wait for you.", wishlist: "Keep track of the games on your radar." }[filterPage];
    return `${heading(label, pageNames[filterPage], description, button(`${icon.plus} Add a game`, "add-game"))}
      ${libraryFilters()}<div class="results-line"><span>${filtered.length} ${filtered.length === 1 ? "game" : "games"}</span>${state.query ? `<button class="clear-search" data-action="clear-search">Clear search “${escapeHtml(state.query)}”</button>` : ""}</div>
      ${filtered.length ? state.view === "grid" ? `<div class="game-grid library-grid">${filtered.map(gameCard).join("")}</div>` : `<div class="game-list">${filtered.map((game) => `<article class="list-row">${cover(game, "list-cover")}<div class="list-primary"><button class="game-title-button" data-action="details" data-id="${escapeHtml(game.id)}">${escapeHtml(game.title)}</button><span>${escapeHtml(game.developer || game.genre || "Game")} · ${escapeHtml(game.platforms.join(", "))}</span></div><span class="card-status ${`status-${game.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}">${escapeHtml(game.status)}</span><span class="list-playtime">${Core.formatPlaytime(game.playtimeMinutes)}</span><button class="icon-button" data-action="details" data-id="${escapeHtml(game.id)}" aria-label="View game">↗</button></article>`).join("")}</div>` : emptyState(state.query ? "No games match that search" : "This part of your universe is waiting", state.query ? "Try another title, platform, genre, or developer." : "Add a game here to start building this collection.")}`;
  }

  function renderAchievements() {
    const total = Core.getStats(state.data);
    const tracked = state.data.games.filter((game) => game.achievementTotal > 0).sort((a, b) => (b.achievementEarned / b.achievementTotal) - (a.achievementEarned / a.achievementTotal));
    return `${heading("MILESTONES & PROGRESS", "Achievements", "Manually track achievements when you want to keep an eye on a game's progress.", button(`${icon.plus} Add a game`, "add-game"))}
      <div class="stats-grid stats-grid-three">${statCard("Unlocked", total.achievementEarned, "Manually recorded", "✦", "lime")}${statCard("Available", total.achievementTotal, "Across tracked games", "◇", "violet")}${statCard("Completion", `${total.achievementPercent}%`, total.achievementTotal ? "Based on recorded counts" : "No achievement data yet", "◎", "blue")}</div>
      ${tracked.length ? `<div class="achievement-list">${tracked.map((game) => `<article class="achievement-row">${cover(game, "achievement-cover")}<div class="achievement-main"><strong>${escapeHtml(game.title)}</strong><span>${game.achievementEarned} of ${game.achievementTotal} unlocked</span><div class="card-progress"><span style="width:${Math.round(game.achievementEarned / game.achievementTotal * 100)}%"></span></div></div><strong>${Math.round(game.achievementEarned / game.achievementTotal * 100)}%</strong><button class="icon-button" data-action="edit-game" data-id="${escapeHtml(game.id)}" aria-label="Edit achievement progress">${icon.edit}</button></article>`).join("")}</div>` : emptyState("Make every milestone count", "Add achievement counts to a game's details to track progress here.", false)}`;
  }

  function renderAnalytics() {
    const stats = Core.getStats(state.data);
    const platforms = new Map();
    state.data.games.forEach((game) => game.platforms.forEach((name) => platforms.set(name, (platforms.get(name) || 0) + 1)));
    const genres = new Map();
    state.data.games.forEach((game) => game.genre && genres.set(game.genre, (genres.get(game.genre) || 0) + 1));
    const maxPlatform = Math.max(1, ...platforms.values());
    const maxGenre = Math.max(1, ...genres.values());
    const topGames = [...state.data.games].filter((game) => game.playtimeMinutes).sort((a, b) => b.playtimeMinutes - a.playtimeMinutes).slice(0, 5);
    return `${heading("YOUR GAMING, AT A GLANCE", "Analytics", "A clear picture, based only on what you've recorded.", "")}
      <div class="stats-grid">${statCard("Total games", stats.totalGames, "In your personal library", "▦", "violet")}${statCard("Time recorded", Core.formatPlaytime(stats.totalPlaytimeMinutes), "Manually entered sessions", "◷", "blue")}${statCard("Completed", stats.completed, `${stats.completionPercent}% of your library`, "✳", "lime")}${statCard("Achievements", stats.achievementEarned, `${stats.achievementPercent}% of recorded total`, "◇", "orange")}</div>
      <div class="analytics-grid"><section class="mini-panel chart-panel"><div class="panel-heading"><div><div class="eyebrow">WHERE YOU PLAY</div><h3>Games by platform</h3></div><span class="panel-icon">▥</span></div>${platforms.size ? [...platforms].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => `<div class="bar-row"><div><span>${escapeHtml(name)}</span><strong>${count}</strong></div><div class="bar-track"><span style="width:${Math.max(7, count / maxPlatform * 100)}%"></span></div></div>`).join("") : `<p class="panel-description">Platform stats will appear when you add games to your library.</p>`}</section>
      <section class="mini-panel chart-panel"><div class="panel-heading"><div><div class="eyebrow">WHAT YOU LOVE</div><h3>Genres in your library</h3></div><span class="panel-icon">✳</span></div>${genres.size ? [...genres].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([name, count]) => `<div class="bar-row genre-row"><div><span>${escapeHtml(name)}</span><strong>${count}</strong></div><div class="bar-track"><span style="width:${Math.max(7, count / maxGenre * 100)}%"></span></div></div>`).join("") : `<p class="panel-description">Add a genre to a game to see your collection's mix.</p>`}</section></div>
      <section class="mini-panel top-played-panel"><div class="panel-heading"><div><div class="eyebrow">YOUR PERSONAL LEADERBOARD</div><h3>Most played</h3></div></div>${topGames.length ? topGames.map((game, index) => `<div class="top-played-row"><span class="rank-number">${String(index + 1).padStart(2, "0")}</span>${cover(game, "top-played-cover")}<strong>${escapeHtml(game.title)}</strong><span>${Core.formatPlaytime(game.playtimeMinutes)}</span></div>`).join("") : `<p class="panel-description">No playtime recorded yet. Add hours in a game's details or track a session.</p>`}</section>`;
  }

  function renderConnections() {
    const imports = [
      ["Steam", "Steam library export", "Import a CSV you export from your own library.", "CSV import available"],
      ["Xbox", "Xbox services", "An authorized account API connection is not configured.", "Not connected"],
      ["PlayStation", "PlayStation Network", "An authorized account API connection is not configured.", "Not connected"],
      ["Epic Games", "Epic Games Store", "An authorized account API connection is not configured.", "Not connected"],
      ["RetroAchievements", "RetroAchievements", "Add achievements manually until an authorized provider is configured.", "Not connected"]
    ];
    return `${heading("ACCOUNTS & IMPORTS", "Connections", "Your library is yours. Integrations are shown only when they can be connected for real.", button("Import library", "import-data", "button button-secondary"))}
      <div class="connection-notice"><span>◈</span><div><strong>No account passwords. No simulated sync.</strong><p>GameVerse doesn't connect to gaming accounts in this build. You can import your own CSV or JSON files; other account syncs stay clearly marked as unavailable.</p></div></div>
      <div class="connection-list">${imports.map(([title, subtitle, description, status]) => `<article class="connection-row"><div class="connection-logo">${escapeHtml(title.slice(0, 1))}</div><div class="connection-main"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span><p>${escapeHtml(description)}</p></div><span class="connection-status ${status.includes("available") ? "available" : ""}"><i></i>${escapeHtml(status)}</span>${title === "Steam" ? button("Import CSV", "import-data", "button button-secondary button-small") : ""}</article>`).join("")}</div>
      <div class="mini-panel platform-panel"><div class="panel-heading"><div><div class="eyebrow">UNIVERSAL BY DESIGN</div><h3>Platform registry</h3></div>${button(`${icon.plus} Add platform`, "add-platform", "button button-secondary button-small")}</div><p class="panel-description">Platforms are extensible. Add any system or storefront when recording a game.</p><div class="platform-chips">${state.data.platforms.slice(0, 24).map((platform) => `<span>${escapeHtml(platform.name)}${platform.custom ? `<i>Custom</i>` : ""}</span>`).join("")}${state.data.platforms.length > 24 ? `<span>+${state.data.platforms.length - 24} more</span>` : ""}</div></div>`;
  }

  function renderCollections() {
    const groups = [
      { title: "Currently playing", note: "Your active adventures", filter: (game) => ["Playing", "Currently replaying"].includes(game.status), color: "collection-purple" },
      { title: "Backlog", note: "Stories still to experience", filter: (game) => ["Backlog", "Not started", "Unplayed", "Paused", "Replay planned"].includes(game.status), color: "collection-lime" },
      { title: "Completed", note: "The journeys you've finished", filter: (game) => ["Completed", "100% completed"].includes(game.status), color: "collection-blue" },
      { title: "Wishlist", note: "For another day", filter: (game) => game.status === "Wishlist" || game.ownership === "Wishlist", color: "collection-orange" }
    ];
    return `${heading("CURATED BY YOU", "Collections", "Your library, thoughtfully sorted by the way you play.", button(`${icon.plus} Add a game`, "add-game"))}<div class="collections-grid">${groups.map((group) => {
      const games = state.data.games.filter(group.filter);
      return `<button class="collection-card ${group.color}" data-action="collection" data-filter="${group.title}"><div class="collection-art">${games.slice(0, 3).map((game, index) => cover(game, `collection-cover collection-cover-${index}`)).join("") || `<span class="collection-empty-mark">✦</span>`}</div><div><span>${games.length} ${games.length === 1 ? "game" : "games"}</span><h3>${group.title}</h3><p>${group.note}</p></div>${icon.arrow}</button>`;
    }).join("")}</div>`;
  }

  function renderSettings() {
    const storageLocation = state.storageMode === "tauri"
      ? state.storagePath || "GameVerse app data directory"
      : state.storageMode === "localstorage"
        ? "This browser's local storage"
        : "This browser's local profile";
    return `${heading("MAKE IT YOURS", "Settings", "Tune your space and keep your data portable.", "")}
      <div class="settings-layout"><div class="settings-nav"><button class="selected">Profile & appearance</button><button data-action="export-json">Export & backup</button><button data-action="import-data">Import library</button><button data-action="page-connections">Connections</button></div>
      <div class="settings-content"><section class="settings-card"><div><div class="eyebrow">YOUR PROFILE</div><h3>A little about you</h3><p>This name appears in your personal GameVerse space.</p></div><form id="profile-form" class="settings-form"><label>Display name<input name="name" maxlength="40" value="${escapeHtml(state.data.profile.name)}" required /></label><button class="button button-primary" type="submit">Save profile</button></form></section>
      <section class="settings-card"><div><div class="eyebrow">APPEARANCE</div><h3>Choose your atmosphere</h3><p>GameVerse is easier on the eyes in the dark, but you choose.</p></div><div class="theme-options"><button class="theme-option ${state.data.profile.theme === "dark" ? "selected" : ""}" data-action="theme-dark"><span class="theme-preview theme-preview-dark"></span><strong>Midnight</strong><small>Dark theme</small></button><button class="theme-option ${state.data.profile.theme === "light" ? "selected" : ""}" data-action="theme-light"><span class="theme-preview theme-preview-light"></span><strong>Daylight</strong><small>Light theme</small></button></div></section>
      <section class="settings-card"><div><div class="eyebrow">YOUR DATA</div><h3>Private by default</h3><p>Your library is stored locally at <span class="storage-location">${escapeHtml(storageLocation)}</span>. Nothing is sent to a server.</p></div><div class="settings-actions">${button("Export JSON backup", "export-json", "button button-secondary")}${button("Export CSV", "export-csv", "button button-secondary")}${button("Import games", "import-data", "button button-secondary")}</div></section>
      <section class="settings-card"><div><div class="eyebrow">CUSTOMIZE</div><h3>Your platform registry</h3><p>Add a console, storefront, or device that matters to you.</p></div><div class="settings-actions">${button(`${icon.plus} Add custom platform`, "add-platform", "button button-secondary")}</div></section>
      </div></div>`;
  }

  function render() {
    const page = state.page;
    if (page === "dashboard") pageContent.innerHTML = renderDashboard();
    else if (["library", "playing", "backlog", "wishlist"].includes(page)) pageContent.innerHTML = renderLibrary(page);
    else if (page === "achievements") pageContent.innerHTML = renderAchievements();
    else if (page === "analytics") pageContent.innerHTML = renderAnalytics();
    else if (page === "connections") pageContent.innerHTML = renderConnections();
    else if (page === "collections") pageContent.innerHTML = renderCollections();
    else pageContent.innerHTML = renderSettings();
    setProfile();
    updateSessionClock();
  }

  function openModal(content) {
    modalContent.innerHTML = content;
    modalBackdrop.hidden = false;
    document.body.classList.add("modal-open");
    const autofocus = modalContent.querySelector("[autofocus], input:not([type=hidden]), select, textarea");
    if (autofocus) window.setTimeout(() => autofocus.focus(), 20);
  }

  function closeModal() {
    modalBackdrop.hidden = true;
    document.body.classList.remove("modal-open");
    state.pendingImport = null;
  }

  function gameForm(game = null) {
    const editing = Boolean(game);
    const platformOptions = state.data.platforms.map((platform) => `<option value="${escapeHtml(platform.name)}" ${game?.platforms.includes(platform.name) ? "selected" : ""}>${escapeHtml(platform.name)}</option>`).join("");
    const formTitle = editing ? "Edit game" : "Add to your universe";
    openModal(`<form id="game-form" class="game-form">
      <div class="modal-header"><div><div class="eyebrow">${editing ? "YOUR LIBRARY" : "A NEW ADVENTURE"}</div><h2 id="modal-title">${formTitle}</h2></div><button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="Close">×</button></div>
      <p class="modal-intro">${editing ? "Update your details. Your recorded history stays yours." : "Add any game from any platform. Your entry stays private on this device."}</p>
      <input type="hidden" name="id" value="${escapeHtml(game?.id || "")}" />
      <div class="form-grid"><label class="span-two">Game title <span class="required">*</span><input name="title" maxlength="120" placeholder="e.g. Hades" value="${escapeHtml(game?.title || "")}" required autofocus /></label>
      <label>Platform <span class="required">*</span><select name="platform" required><option value="">Choose a platform</option>${platformOptions}</select></label>
      <label>Other platforms <span class="field-hint">Separate names with commas</span><input name="otherPlatforms" maxlength="250" placeholder="Optional" value="${escapeHtml(game?.platforms.slice(1).join(", ") || "")}" /></label>
      <label>Status<select name="status">${Core.STATUSES.map((status) => `<option ${game?.status === status || (!game && status === "Backlog") ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}</select></label>
      <label>Ownership<select name="ownership">${["Owned", "Subscription", "Wishlist", "Not owned"].map((item) => `<option ${game?.ownership === item || (!game && item === "Owned") ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>Developer<input name="developer" maxlength="100" placeholder="Studio name" value="${escapeHtml(game?.developer || "")}" /></label>
      <label>Genre<input name="genre" maxlength="50" placeholder="Action, RPG, ..." value="${escapeHtml(game?.genre || "")}" /></label>
      <label>Hours played<input name="playtimeHours" type="number" min="0" max="1000000" step="0.01" value="${game ? (game.playtimeMinutes / 60).toFixed(2) : "0"}" /></label>
      <label>Progress (%)<input name="progress" type="number" min="0" max="100" value="${game?.progress || 0}" /></label>
      <label>Your rating (1–5)<input name="rating" type="number" min="1" max="5" step="0.5" placeholder="Not rated" value="${game?.rating ?? ""}" /></label>
      <label>Priority (1–5)<input name="priority" type="number" min="1" max="5" value="${game?.priority || 3}" /></label>
      <label>Achievements earned<input name="achievementEarned" type="number" min="0" value="${game?.achievementEarned || 0}" /></label>
      <label>Total achievements<input name="achievementTotal" type="number" min="0" value="${game?.achievementTotal || 0}" /></label>
      <label class="span-two">Cover artwork URL <span class="field-hint">Optional · secure HTTPS link only</span><input name="coverUrl" type="url" placeholder="https://..." value="${escapeHtml(game?.coverUrl || "")}" /></label>
      <label class="span-two">Notes <textarea name="notes" rows="3" maxlength="2000" placeholder="Anything you want to remember...">${escapeHtml(game?.notes || "")}</textarea></label></div>
      <div class="modal-footer"><span class="form-hint">Fields stay on this device unless you export them.</span><div>${editing ? `<button type="button" class="button button-danger-quiet" data-action="delete-game" data-id="${escapeHtml(game.id)}">Remove game</button>` : ""}<button type="button" class="button button-secondary" data-action="close-modal">Cancel</button><button type="submit" class="button button-primary">${editing ? "Save changes" : "Add game"}</button></div></div>
    </form>`);
  }

  function gameDetails(game) {
    const active = state.data.activeSession?.gameId === game.id;
    const sessions = state.data.sessions.filter((session) => session.gameId === game.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    openModal(`<div class="detail-modal"><div class="detail-hero">${cover(game, "detail-cover")}<button class="icon-button modal-close detail-close" data-action="close-modal" aria-label="Close">×</button><div class="detail-overlay"><span class="card-status status-${game.status.toLowerCase().replace(/[^a-z0-9]+/g, "-")}">${escapeHtml(game.status)}</span><h2 id="modal-title">${escapeHtml(game.title)}</h2><p>${escapeHtml([game.developer, game.releaseYear, game.genre].filter(Boolean).join(" · ") || "Personal game record")}</p></div></div>
      <div class="detail-body"><div class="detail-stats"><div><span>PLAYTIME</span><strong>${Core.formatPlaytime(game.playtimeMinutes)}</strong></div><div><span>PROGRESS</span><strong>${game.progress}%</strong></div><div><span>YOUR RATING</span><strong>${game.rating ? `★ ${game.rating.toFixed(1)}` : "—"}</strong></div></div>
      <div class="detail-platforms">${game.platforms.map((platform) => `<span>${escapeHtml(platform)}</span>`).join("") || "<span>Platform not specified</span>"}<span class="ownership-chip">${escapeHtml(game.ownership)}</span></div>
      <div class="detail-progress"><div><span>Game progress</span><strong>${game.progress}%</strong></div><div class="card-progress"><span style="width:${game.progress}%"></span></div></div>
      ${game.achievementTotal ? `<div class="detail-achievements"><span>Achievement progress</span><strong>${game.achievementEarned} / ${game.achievementTotal}</strong></div>` : ""}
      ${game.notes ? `<div class="detail-notes"><span class="eyebrow">YOUR NOTES</span><p>${escapeHtml(game.notes)}</p></div>` : ""}
      <div class="detail-session">${active ? `<span class="live-dot"></span><strong>Session active</strong><span id="session-clock"></span>${button("End session", "stop-session", "button button-secondary button-small")}` : button(`${icon.play} Start a session`, "start-session", "button button-lime", `data-id="${escapeHtml(game.id)}"`)}<button class="text-button" data-action="log-session" data-id="${escapeHtml(game.id)}">${icon.clock} Log past time</button></div>
      <div class="session-history">${sessions.length ? `<div class="eyebrow">RECENT SESSIONS</div>${sessions.slice(0, 3).map((session) => `<div><span>${new Date(session.startedAt).toLocaleDateString()}</span><strong>${Core.formatPlaytime(session.durationMinutes)}</strong></div>`).join("")}` : ""}</div>
      <div class="detail-footer"><span>Added ${new Date(game.createdAt).toLocaleDateString()}</span><button class="button button-secondary" data-action="edit-game" data-id="${escapeHtml(game.id)}">${icon.edit} Edit details</button></div></div></div>`);
  }

  function openLogSession(game) {
    openModal(`<form id="session-form"><div class="modal-header"><div><div class="eyebrow">PLAY HISTORY</div><h2 id="modal-title">Log a session</h2></div><button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="Close">×</button></div><p class="modal-intro">Manually add time you played ${escapeHtml(game.title)}. It will be added to your total.</p><input type="hidden" name="gameId" value="${escapeHtml(game.id)}" /><div class="form-grid"><label>Hours<input name="hours" type="number" min="0" max="10000" step="0.1" value="1" required /></label><label>Played on<input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></label><label class="span-two">Session notes<textarea name="notes" rows="3" maxlength="500" placeholder="Optional"></textarea></label></div><div class="modal-footer"><span></span><div><button type="button" class="button button-secondary" data-action="close-modal">Cancel</button><button type="submit" class="button button-primary">Save session</button></div></div></form>`);
  }

  function openAddPlatform() {
    openModal(`<form id="platform-form"><div class="modal-header"><div><div class="eyebrow">YOUR PLATFORM REGISTRY</div><h2 id="modal-title">Add a platform</h2></div><button type="button" class="icon-button modal-close" data-action="close-modal" aria-label="Close">×</button></div><p class="modal-intro">Add any console, storefront, handheld, or device to your personal registry.</p><label>Platform name<input name="name" maxlength="50" placeholder="e.g. Playdate" required autofocus /></label><label>Platform family<input name="family" maxlength="50" placeholder="e.g. Handheld" /></label><div class="modal-footer"><span></span><div><button type="button" class="button button-secondary" data-action="close-modal">Cancel</button><button type="submit" class="button button-primary">Add platform</button></div></div></form>`);
  }

  function activeSessionStart(gameId) {
    if (state.data.activeSession) return toast("Finish your current session before starting another.", "error");
    const game = state.data.games.find((item) => item.id === gameId);
    if (!game) return toast("That game is no longer in your library.", "error");
    const detailsOpen = !modalBackdrop.hidden;
    state.data.activeSession = { gameId, platform: game.platforms[0] || "", startedAt: new Date().toISOString() };
    if (["Backlog", "Not started", "Unplayed"].includes(game.status)) {
      game.status = "Playing";
      game.updatedAt = new Date().toISOString();
    }
    save().then(() => {
      toast(`Session started: ${game.title}`);
      render();
      if (detailsOpen) gameDetails(game);
    });
  }

  function activeSessionStop() {
    const active = state.data.activeSession;
    if (!active) return toast("There isn't an active session.", "error");
    const detailsOpen = !modalBackdrop.hidden;
    const elapsed = Math.max(1, Math.round((Date.now() - Date.parse(active.startedAt)) / 60000));
    const game = state.data.games.find((item) => item.id === active.gameId);
    if (game) {
      game.playtimeMinutes += elapsed;
      game.updatedAt = new Date().toISOString();
      state.data.sessions.unshift({ id: Core.createId(), gameId: active.gameId, platform: active.platform, startedAt: active.startedAt, durationMinutes: elapsed, notes: "" });
    }
    state.data.activeSession = null;
    save().then(() => {
      toast(`Session saved · ${Core.formatPlaytime(elapsed)}`);
      render();
      if (detailsOpen && game) gameDetails(game);
    });
  }

  function updateSessionClock() {
    const active = state.data.activeSession;
    const node = document.getElementById("session-clock");
    if (!node || !active) return;
    const minutes = Math.floor((Date.now() - Date.parse(active.startedAt)) / 60000);
    node.textContent = `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }

  function download(name, content, type) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function startImport() {
    fileInput.value = "";
    fileInput.click();
  }

  async function readImport(file) {
    try {
      const text = await file.text();
      let records;
      let backup = null;
      if (file.name.toLowerCase().endsWith(".csv")) records = Core.parseCsv(text);
      else {
        const parsed = JSON.parse(text);
        records = Array.isArray(parsed) ? parsed : parsed.games;
        if (!Array.isArray(records)) throw new Error("This JSON file must contain a games array.");
        if (!Array.isArray(parsed)) backup = parsed;
      }
      const preview = Core.previewImport(state.data, records);
      state.pendingImport = { records, backup };
      const errorText = preview.invalid ? `${preview.invalid} row${preview.invalid === 1 ? "" : "s"} could not be read. ` : "";
      openModal(`<div class="modal-header"><div><div class="eyebrow">IMPORT PREVIEW</div><h2 id="modal-title">Review your library import</h2></div><button class="icon-button modal-close" data-action="close-modal" aria-label="Close">×</button></div><p class="modal-intro">${escapeHtml(file.name)} · Review before anything is added. Existing games will never be overwritten.</p><div class="import-summary"><div><strong>${preview.additions.length}</strong><span>new games</span></div><div><strong>${preview.duplicates.length}</strong><span>duplicates skipped</span></div><div><strong>${preview.invalid}</strong><span>unreadable rows</span></div></div>${preview.additions.length ? `<div class="import-preview-list">${preview.additions.slice(0, 7).map((game) => `<div><span>${escapeHtml(game.title)}</span><small>${escapeHtml(game.platforms.join(", ") || "No platform")}</small></div>`).join("")}${preview.additions.length > 7 ? `<small>and ${preview.additions.length - 7} more…</small>` : ""}</div>` : `<p class="panel-description">No new games found. ${preview.duplicates.length ? "These titles appear to already exist in your library." : "Check the file format and try again."}</p>`}<div class="modal-footer"><span class="form-hint">${errorText}${preview.duplicates.length ? "Duplicates are skipped; existing records stay unchanged." : "You can undo this later by removing imported entries."}</span><div><button class="button button-secondary" data-action="close-modal">Cancel</button>${preview.additions.length ? `<button class="button button-primary" data-action="confirm-import">Add ${preview.additions.length} games</button>` : ""}</div></div>`);
    } catch (error) {
      toast(`Import failed: ${error.message}`, "error");
    }
  }

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-page]");
    if (nav) { event.preventDefault(); setPage(nav.dataset.page); return; }
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const { action, id } = target.dataset;
    if (action === "add-game") gameForm();
    else if (action === "details") { const game = state.data.games.find((item) => item.id === id); if (game) gameDetails(game); }
    else if (action === "edit-game") { const game = state.data.games.find((item) => item.id === id); if (game) gameForm(game); }
    else if (action === "close-modal") closeModal();
    else if (action === "delete-game") {
      const game = state.data.games.find((item) => item.id === id);
      if (game && window.confirm(`Remove "${game.title}" and its session history from your library?`)) {
        state.data = Core.deleteGame(state.data, id);
        await save(); closeModal(); render(); toast("Game removed from your library.");
      }
    } else if (action === "start-session") activeSessionStart(id);
    else if (action === "stop-session") activeSessionStop();
    else if (action === "log-session") { const game = state.data.games.find((item) => item.id === id); if (game) openLogSession(game); }
    else if (action === "page-library") setPage("library");
    else if (action === "page-backlog") setPage("backlog");
    else if (action === "page-connections") setPage("connections");
    else if (action === "clear-search") { state.query = ""; searchInput.value = ""; render(); }
    else if (action === "view-grid" || action === "view-list") { state.view = action.slice(5); render(); }
    else if (action === "add-platform") openAddPlatform();
    else if (action === "import-data") startImport();
    else if (action === "export-json") download("gameverse-backup.json", JSON.stringify({ exportedAt: new Date().toISOString(), ...state.data }, null, 2), "application/json");
    else if (action === "export-csv") download("gameverse-library.csv", Core.toCsv(state.data.games), "text/csv;charset=utf-8");
    else if (action === "theme-dark" || action === "theme-light") { state.data.profile.theme = action === "theme-dark" ? "dark" : "light"; await save(); render(); }
    else if (action === "collection") {
      const filter = target.dataset.filter;
      state.filterStatus = filter === "Completed" ? "Completed" : "";
      state.filterPlatform = "";
      setPage(filter === "Currently playing" ? "playing" : filter === "Backlog" ? "backlog" : filter === "Wishlist" ? "wishlist" : "library");
    } else if (action === "confirm-import" && state.pendingImport) {
      const result = Core.mergeImport(state.data, state.pendingImport.records, state.pendingImport.backup);
      state.data = result.state;
      await save(); closeModal(); state.page = "library"; render();
      toast(`${result.additions.length} games imported${result.importedSessions ? ` · ${result.importedSessions} sessions restored` : ""}${result.duplicates.length ? ` · ${result.duplicates.length} duplicates skipped` : ""}`);
    }
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!form || form.tagName !== "FORM") return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    const formType = form.getAttribute("id");
    if (formType === "game-form") {
      const existing = values.id && state.data.games.find((game) => game.id === values.id);
      const platforms = [values.platform, ...values.otherPlatforms.split(",").map((name) => name.trim())].filter(Boolean);
      const input = {
        ...values,
        platforms: platforms.length ? [...new Set(platforms)] : existing?.platforms || [],
        playtimeMinutes: Math.round(Number(values.playtimeHours || 0) * 60),
        rating: values.rating === "" ? null : Number(values.rating),
        progress: Number(values.progress),
        priority: Number(values.priority),
        achievementEarned: Number(values.achievementEarned || 0),
        achievementTotal: Number(values.achievementTotal || 0)
      };
      if (input.achievementEarned > input.achievementTotal) return toast("Achievements earned can't exceed the total available.", "error");
      if (values.coverUrl && Core.safeCoverUrl(values.coverUrl) !== values.coverUrl) return toast("Cover artwork must use a valid HTTPS URL.", "error");
      try {
        const result = existing ? Core.updateGame(state.data, existing.id, input) : Core.addGame(state.data, input);
        state.data = result.state;
        await save(); closeModal(); render(); toast(existing ? "Game details updated." : `${result.game.title} added to your library.`);
      } catch (error) { toast(error.message, "error"); }
    } else if (formType === "profile-form") {
      state.data.profile.name = values.name.trim() || "Gamer";
      await save(); render(); toast("Profile saved.");
    } else if (formType === "session-form") {
      const game = state.data.games.find((item) => item.id === values.gameId);
      const minutes = Math.round(Number(values.hours) * 60);
      if (!game || minutes < 1) return toast("Enter a session duration greater than zero.", "error");
      const started = new Date(`${values.date}T12:00:00`).toISOString();
      state.data.sessions.unshift({ id: Core.createId(), gameId: game.id, platform: game.platforms[0] || "", startedAt: started, durationMinutes: minutes, notes: values.notes.trim() });
      game.playtimeMinutes += minutes;
      game.updatedAt = new Date().toISOString();
      await save(); closeModal(); render(); toast(`${Core.formatPlaytime(minutes)} added to ${game.title}.`);
    } else if (formType === "platform-form") {
      const name = values.name.trim();
      if (state.data.platforms.some((platform) => platform.name.toLowerCase() === name.toLowerCase())) return toast("That platform is already in your registry.", "error");
      state.data.platforms.push({ id: Core.createId(), name, group: values.family.trim() || "Custom platforms", custom: true });
      await save(); closeModal(); render(); toast(`${name} added to your platform registry.`);
    }
  });

  searchInput.addEventListener("input", () => { state.query = searchInput.value; if (state.page === "dashboard") setPage("library"); else render(); });
  pageContent.addEventListener("change", (event) => {
    if (event.target.id === "status-filter") { state.filterStatus = event.target.value; render(); }
    if (event.target.id === "platform-filter") { state.filterPlatform = event.target.value; render(); }
    if (event.target.id === "sort-filter") { state.sort = event.target.value; render(); }
  });
  fileInput.addEventListener("change", () => { if (fileInput.files[0]) readImport(fileInput.files[0]); });
  modalBackdrop.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });
  document.getElementById("theme-toggle").addEventListener("click", async () => {
    state.data.profile.theme = state.data.profile.theme === "dark" ? "light" : "dark";
    await save(); render();
  });
  document.getElementById("menu-button").addEventListener("click", () => document.getElementById("sidebar").classList.toggle("sidebar-open"));
  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); searchInput.focus(); }
    if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
  });

  async function boot() {
    try {
      const result = await window.GameVerseStorage.load();
      state.storageMode = result.mode;
      state.data = Core.normalizeState(result.state);
      if (state.storageMode === "tauri") {
        try {
          state.storagePath = await window.__TAURI__.core.invoke("storage_location");
        } catch (error) {
          toast(`Could not determine the desktop data location: ${error.message}`, "error");
        }
      }
      if (result.warning) {
        const warning = document.getElementById("storage-warning");
        warning.hidden = false;
        warning.textContent = `IndexedDB is unavailable. GameVerse is using this browser's local storage instead: ${result.warning}`;
      }
      await save();
      setProfile();
      render();
      state.sessionTick = window.setInterval(updateSessionClock, 15000);
    } catch (error) {
      pageContent.innerHTML = `<div class="fatal-error"><h1>Your library could not be opened</h1><p>${escapeHtml(error.message)}</p><button class="button button-primary" onclick="location.reload()">Try again</button></div>`;
    }
  }
  boot();
})();
