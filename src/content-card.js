import { inlineRuns } from "./text-format.js";

export function validCard(card) {
  if (card?.type === "table") {
    const columns = card.rows?.[0]?.length;
    return (
      Array.isArray(card.rows) &&
      card.rows.length > 0 &&
      card.rows.length <= 500 &&
      columns > 0 &&
      columns <= 50 &&
      typeof card.header === "boolean" &&
      (card.alignments === undefined ||
        (Array.isArray(card.alignments) &&
          card.alignments.length === columns &&
          card.alignments.every((alignment) =>
            ["left", "center", "right"].includes(alignment),
          ))) &&
      card.rows.every(
        (row) =>
          Array.isArray(row) &&
          row.length === columns &&
          row.every((cell) => typeof cell === "string" && cell.length <= 10000),
      )
    );
  }
  return (
    ["code", "latex"].includes(card?.type) &&
    typeof card.source === "string" &&
    card.source.length <= 100000 &&
    typeof card.language === "string" &&
    /^[\w+#.-]{0,40}$/.test(card.language)
  );
}

export function clipboardCard(text, html, doc) {
  const source = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^(?:[ \t]*\n)+|(?:\n[ \t]*)+$/g, "");
  const fence = /^[ \t]*(`{3,}|~{3,})([\w+#.-]{0,40})[ \t]*\n/.exec(source);
  if (fence) {
    const lines = source.slice(fence[0].length).split("\n");
    while (lines.at(-1) === "") lines.pop();
    if (lines.at(-1)?.trim() === fence[1]) {
      lines.pop();
      const language = fence[2].toLowerCase();
      if (language !== "mermaid")
        return {
          type: ["tex", "latex"].includes(language) ? "latex" : "code",
          language,
          source: lines.join("\n"),
        };
    }
    return null;
  }
  const equation =
    /^(?:\$\$([\s\S]+)\$\$|\|(?:latex|tex)[ \t]*\n([\s\S]+)\n\|)$/.exec(
      source.trim(),
    );
  if (equation)
    return {
      type: "latex",
      language: "latex",
      source: equation[1] ?? equation[2],
    };
  const lines = source.replace(/\n+$/, "").split("\n");
  const split = (line) =>
    line
      .trim()
      .replace(/^\||(?<!\\)\|$/g, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replaceAll("\\|", "|"));
  let rows,
    alignments,
    header = false;
  if (
    lines.length >= 2 &&
    lines[0].includes("|") &&
    split(lines[1]).every((cell) => /^:?-{3,}:?$/.test(cell))
  ) {
    rows = [lines[0], ...lines.slice(2).filter((line) => line.trim())].map(
      split,
    );
    header = true;
    alignments = split(lines[1]).map((cell) =>
      cell.endsWith(":") ? (cell.startsWith(":") ? "center" : "right") : "left",
    );
  } else if (html) {
    const table = new doc.defaultView.DOMParser()
      .parseFromString(html, "text/html")
      .querySelector("table");
    if (table) {
      rows = Array.from(table.rows, (row) =>
        Array.from(row.cells, (cell) => cell.textContent),
      );
      header = !!table.rows[0]?.querySelector("th");
    }
  }
  if (!rows && lines.some((line) => line.includes("\t")))
    rows = lines.map((line) => line.split("\t"));
  if (!rows?.length) return null;
  const columns = Math.max(...rows.map((row) => row.length));
  return {
    type: "table",
    header,
    ...(alignments
      ? {
          alignments: Array.from(
            { length: columns },
            (_, index) => alignments[index] || "left",
          ),
        }
      : {}),
    rows: rows.map((row) =>
      Array.from({ length: columns }, (_, col) => row[col] ?? ""),
    ),
  };
}

export function cardTitle(card) {
  if (card.type === "table")
    return `Table (${card.rows.length} × ${card.rows[0].length})`;
  return card.type === "latex"
    ? "LaTeX"
    : card.language
      ? `Code (${card.language})`
      : "Code";
}

function renderTableCell(doc, cell, value) {
  for (const run of inlineRuns(value)) {
    let child = doc.createTextNode(run.text);
    for (const [style, tag] of [
      ["bold", "strong"],
      ["italic", "em"],
      ["code", "code"],
    ]) {
      if (!run[style]) continue;
      const wrapper = doc.createElement(tag);
      wrapper.append(child);
      child = wrapper;
    }
    if (run.link) {
      const link = doc.createElement("a");
      link.dataset.textLink = run.link;
      link.dataset.internal = String(run.internal);
      link.tabIndex = 0;
      link.setAttribute("role", "link");
      link.append(child);
      child = link;
    }
    cell.append(child);
  }
}

export function appendTableField(doc, cell, value, row, column) {
  const input = doc.createElement("textarea");
  input.rows = 1;
  input.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}`);
  input.value = value;
  const preview = doc.createElement("span");
  preview.className = "rea-cell-preview";
  preview.setAttribute("aria-hidden", "true");
  preview.inert = true;
  const refresh = () => {
    preview.replaceChildren();
    renderTableCell(doc, preview, input.value);
  };
  input.addEventListener("input", refresh);
  refresh();
  cell.append(input, preview);
  return input;
}

export function cardContent(doc, card, renderMath, editable = false) {
  if (card.type === "table") {
    const table = doc.createElement("table");
    card.rows.forEach((row, index) => {
      const tr = table.insertRow();
      for (const [column, value] of row.entries()) {
        const cell = doc.createElement(
          card.header && index === 0 ? "th" : "td",
        );
        if (card.alignments)
          cell.classList.add("rea-cell-" + card.alignments[column]);
        if (editable) {
          appendTableField(doc, cell, value, index, column);
        } else {
          renderTableCell(doc, cell, value);
        }
        tr.append(cell);
      }
    });
    return table;
  }
  if (editable) {
    const input = doc.createElement("textarea");
    input.setAttribute("aria-label", cardTitle(card) + " source");
    input.spellcheck = false;
    input.value = card.source;
    return input;
  }
  if (card.type === "latex" && renderMath) {
    try {
      return renderMath(card.source, true);
    } catch {
      // Keep the source visible when the renderer rejects a draft.
    }
  }
  const pre = doc.createElement("pre");
  pre.textContent = card.source;
  return pre;
}

export function cardNode(card) {
  return {
    fill: "#ffffff",
    stroke: "#cbd5e1",
    shape: "rect",
    label: cardTitle(card),
    card,
    size:
      card.type === "table"
        ? {
            width: Math.min(760, Math.max(200, card.rows[0].length * 144)),
            height: Math.min(420, Math.max(60, 20 + card.rows.length * 32)),
          }
        : {
            width: 380,
            height: Math.min(
              360,
              Math.max(100, 28 + card.source.split("\n").length * 21),
            ),
          },
  };
}

export const cardTypes = {
  table: {
    type: "table",
    header: true,
    rows: [
      ["Column 1", "Column 2"],
      ["", ""],
    ],
  },
  code: { type: "code", language: "", source: "" },
  latex: { type: "latex", language: "latex", source: "" },
};
