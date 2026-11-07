const paths = {
  hand: "M6 12V7a2 2 0 014 0V4a2 2 0 014 0v3a2 2 0 014 0v5a2 2 0 014 0v3a8 8 0 01-15 4l-3-5a2 2 0 012-3l2 1",
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6L7 7m10 10l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M16 12a4 4 0 11-8 0 4 4 0 018 0",
  moon: "M20 14a8 8 0 01-10-10 8 8 0 1010 10",
  select: "M5 3l14 9-7 1-3 7z",
  rect: "M5 5h14v14H5z",
  round: "M8 6h8a6 6 0 010 12H8A6 6 0 018 6z",
  diamond: "M12 3l9 9-9 9-9-9z",
  connect: "M5 19L19 5M8 5h11v11",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  source: "M8 8l-4 4 4 4m8-8l4 4-4 4m-3-11l-2 22",
  export: "M12 15V3m-4 4l4-4 4 4M5 14v6h14v-6",
  import: "M12 3v12m-4-4l4 4 4-4M5 14v6h14v-6",
  arrange: "M4 4h5v5H4zm11 0h5v5h-5zM4 15h5v5H4zm11 0h5v5h-5z",
  undo: "M9 5L4 10l5 5M4 10h10a6 6 0 010 12",
  redo: "M15 5l5 5-5 5m5-5H10a6 6 0 000 12",
  minus: "M5 12h14",
  plus: "M5 12h14M12 5v14",
  fit: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
  duplicate: "M9 9h12v12H9zM15 9V3H3v12h6",
  text: "M4 5h16M12 5v15m-4 0h8",
  link: "M10 14l4-4m-5 7l-1 1a4 4 0 01-6-6l4-4a4 4 0 016 0m0 8a4 4 0 006 0l4-4a4 4 0 00-6-6l-1 1",
  close: "M6 6l12 12M18 6L6 18",
  board: "M4 4h16v13H4zM9 21l3-4 3 4M8 8h3m2 5h3m-5-5l2 5",
};
export function icon(name) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"> ${name === "more" ? '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>' : `<path d="${paths[name] || paths.rect}"/>`}</svg>`;
}
export function button(name, label, attrs = "") {
  return `<button type="button" aria-label="${label}" title="${label}" ${attrs}>${icon(name)}</button>`;
}
