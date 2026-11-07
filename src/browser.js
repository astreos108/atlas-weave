import { mount } from "./canvas.js";
import { INITIAL } from "./model.js";
import "../styles.css";
import "./browser.css";
const key = "rea-whimsical-board-v1";
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
  snap: localStorage.getItem("rea-whimsical-snap") !== "false",
  setSnap: (value) => localStorage.setItem("rea-whimsical-snap", String(value)),
  theme: localStorage.getItem("rea-whimsical-theme") || "light",
  setTheme: (theme) => localStorage.setItem("rea-whimsical-theme", theme),
  source: saved?.source || INITIAL,
  title: saved?.title || "A little room to think",
  save: async (source, title) =>
    localStorage.setItem(key, JSON.stringify({ source, title })),
});
