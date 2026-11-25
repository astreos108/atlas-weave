import { mount } from "./canvas.js";
import { INITIAL } from "./model.js";
import "../styles.css";
import "./browser.css";
const key = "atlasweave-board-v1";
let saved;
try {
  saved = JSON.parse(localStorage.getItem(key));
} catch {
  /* Ignore corrupt demo storage and start with a new board. */
}
mount(document.querySelector("#app"), {
  background: localStorage.getItem("rea-board-background") || "ivory",
  showGrid: localStorage.getItem("rea-board-grid") !== "false",
  setAppearance: ({ background, showGrid }) => {
    localStorage.setItem("rea-board-background", background);
    localStorage.setItem("rea-board-grid", String(showGrid));
  },
  counterEnabled: localStorage.getItem("rea-board-counter") === "true",
  characterTarget:
    Number(localStorage.getItem("rea-board-character-target")) || 280,
  setTextPreferences: ({ counterEnabled, characterTarget }) => {
    localStorage.setItem("rea-board-counter", String(counterEnabled));
    localStorage.setItem("rea-board-character-target", String(characterTarget));
  },
  snap: localStorage.getItem("atlasweave-snap") !== "false",
  setSnap: (value) => localStorage.setItem("atlasweave-snap", String(value)),
  theme: localStorage.getItem("atlasweave-theme") || "light",
  setTheme: (theme) => localStorage.setItem("atlasweave-theme", theme),
  source: saved?.source || INITIAL,
  title: saved?.title || "A little room to think",
  save: async (source, title) =>
    localStorage.setItem(key, JSON.stringify({ source, title })),
});
