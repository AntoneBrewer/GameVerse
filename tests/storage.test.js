const test = require("node:test");
const assert = require("node:assert/strict");
require("../src/storage.js");

test("desktop persistence uses Rust commands and reports native failures", async () => {
  const previous = globalThis.__TAURI__;
  const calls = [];
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        calls.push({ command, args });
        if (command === "load_library") return { games: [] };
        if (command === "save_library") return undefined;
      }
    }
  };
  try {
    const loaded = await globalThis.GameVerseStorage.load();
    assert.equal(loaded.mode, "tauri");
    assert.deepEqual(loaded.state, { games: [] });

    await globalThis.GameVerseStorage.save({ games: [{ title: "Hades" }] }, "tauri");
    assert.deepEqual(calls, [
      { command: "load_library", args: undefined },
      { command: "save_library", args: { state: { games: [{ title: "Hades" }] } } }
    ]);

    globalThis.__TAURI__.core.invoke = async () => {
      throw new Error("native disk is unavailable");
    };
    await assert.rejects(globalThis.GameVerseStorage.load(), /native disk is unavailable/);
    await assert.rejects(
      globalThis.GameVerseStorage.save({ games: [] }, "tauri"),
      /native disk is unavailable/
    );
  } finally {
    if (previous === undefined) delete globalThis.__TAURI__;
    else globalThis.__TAURI__ = previous;
  }
});
