// Draws the fictional demo photos (scripts/demo-photos/*.jpg) in a headless
// browser. Run once: node scripts/make-demo-photos.mjs
// Every image is synthetic and labeled "DEMO PHOTO – fictional" (CLAUDE.md §8).
import { writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const PHOTOS = {
  "elevation-north": "North elevation, 123 Demo Street",
  "inspector-drop": "Inspector on scaffold, drop 1",
  "parapet-coping": "Loose parapet coping, roof",
  "brick-cracking": "Step cracking, 3rd floor pier",
  "lintel-rust": "Rust at steel lintel, 5th floor",
  "probe-opening": "Probe opening, wall ties visible",
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, label] of Object.entries(PHOTOS)) {
  const base64 = await page.evaluate(
    ({ name, label }) => {
      const c = document.createElement("canvas");
      c.width = 1600;
      c.height = 1200;
      const ctx = c.getContext("2d");
      // Brick wall
      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(0, 0, 1600, 1200);
      for (let row = 0; row < 40; row++) {
        for (let col = -1; col < 22; col++) {
          const x = col * 80 + (row % 2 ? 40 : 0);
          const shade = 120 + ((row * 7 + col * 13) % 30);
          ctx.fillStyle = `rgb(${shade + 40}, ${shade - 40}, ${shade - 60})`;
          ctx.fillRect(x + 3, row * 30 + 3, 74, 24);
        }
      }
      ctx.strokeStyle = "#2b2b2b";
      ctx.lineWidth = 6;
      if (name === "brick-cracking") {
        ctx.beginPath();
        ctx.moveTo(500, 200);
        for (let i = 1; i < 12; i++) ctx.lineTo(500 + i * 50, 200 + i * 60 + (i % 2 ? 0 : 30));
        ctx.stroke();
      }
      if (name === "lintel-rust") {
        ctx.fillStyle = "#6b3a1e";
        ctx.fillRect(300, 500, 1000, 70);
        ctx.fillStyle = "#b5651d";
        for (let i = 0; i < 40; i++) ctx.fillRect(300 + i * 25, 570, 10, 20 + (i % 5) * 12);
      }
      if (name === "parapet-coping") {
        ctx.fillStyle = "#cfcfc4";
        for (let i = 0; i < 6; i++) ctx.fillRect(i * 280, 180 + (i === 3 ? 40 : 0), 260, 90);
      }
      if (name === "probe-opening") {
        ctx.fillStyle = "#1f1f1f";
        ctx.fillRect(600, 450, 400, 300);
        ctx.strokeStyle = "#c0c0c0";
        ctx.beginPath();
        ctx.moveTo(620, 600);
        ctx.lineTo(980, 600);
        ctx.stroke();
      }
      if (name === "elevation-north") {
        ctx.fillStyle = "#dfe7ef";
        ctx.fillRect(0, 0, 1600, 160);
        ctx.fillStyle = "#3b4a5a";
        for (let r = 0; r < 8; r++) for (let w = 0; w < 7; w++) ctx.fillRect(140 + w * 200, 220 + r * 120, 90, 80);
      }
      if (name === "inspector-drop") {
        ctx.strokeStyle = "#f2c200";
        ctx.lineWidth = 14;
        for (let y = 100; y < 1200; y += 220) {
          ctx.beginPath();
          ctx.moveTo(200, y);
          ctx.lineTo(1400, y);
          ctx.stroke();
        }
        ctx.fillStyle = "#ff7a00";
        ctx.fillRect(740, 420, 120, 220);
        ctx.beginPath();
        ctx.arc(800, 380, 50, 0, Math.PI * 2);
        ctx.fill();
      }
      // Label
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillRect(0, 1060, 1600, 140);
      ctx.fillStyle = "#b91c1c";
      ctx.font = "bold 56px sans-serif";
      ctx.fillText("DEMO PHOTO – fictional", 40, 1120);
      ctx.fillStyle = "#111";
      ctx.font = "40px sans-serif";
      ctx.fillText(label, 40, 1175);
      return c.toDataURL("image/jpeg", 0.72).split(",")[1];
    },
    { name, label },
  );
  await writeFile(`scripts/demo-photos/${name}.jpg`, Buffer.from(base64, "base64"));
  console.log(`scripts/demo-photos/${name}.jpg`);
}
await browser.close();
