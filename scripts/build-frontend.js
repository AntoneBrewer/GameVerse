const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");

async function build() {
  await fs.rm(output, { recursive: true, force: true });
  await fs.mkdir(output, { recursive: true });
  for (const entry of ["index.html", "styles.css", "src"]) {
    await fs.cp(path.join(root, entry), path.join(output, entry), { recursive: true });
  }
  process.stdout.write("GameVerse frontend copied to dist/.\n");
}

build().catch((error) => {
  console.error(`Frontend build failed: ${error.message}`);
  process.exitCode = 1;
});
