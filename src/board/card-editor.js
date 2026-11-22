import {
  appendTableField,
  cardContent,
  cardNode,
  cardTitle,
  validCard,
} from "../content-card.js";

export function createCardEditor({
  doc,
  win,
  root,
  canvas,
  signal,
  renderMath,
  getZoom,
  toLocal,
  selectCard,
  selectionControls,
  status,
  change,
}) {
  let closeCardEditor, positionCardEditor;
  function editCard(node, row = 0, column = 0) {
    closeCardEditor?.();
    const draft = structuredClone(node.card);
    const original = JSON.stringify(draft);
    const panel = doc.createElement("form");
    panel.className = "rea-card-editor";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Edit " + cardTitle(draft));
    const toolbar = doc.createElement("header");
    const title = doc.createElement("strong");
    title.textContent = cardTitle(draft);
    toolbar.append(title);
    const button = (label, text, action) => {
      const control = doc.createElement("button");
      control.textContent = text;
      control.title = label;
      control.setAttribute("aria-label", label);
      control.type = action ? "button" : "submit";
      if (action) control.addEventListener("click", action);
      return control;
    };
    let content = cardContent(doc, draft, renderMath, true);
    const body = doc.createElement("div");
    body.className = "rea-card-edit-body";
    if (draft.type !== "table") panel.append(toolbar);
    panel.append(body);
    let previewFrame;
    let tableColumns;
    let columnWidths;
    let refreshTableHandles;
    if (draft.type === "table") {
      panel.classList.add("rea-table-editor");
      const grid = doc.createElement("div");
      grid.className = "rea-table-edit-grid";
      const viewport = doc.createElement("div");
      viewport.className = "rea-table-edit-viewport";
      const renderedRow = node.cardEl.querySelector("tr");
      columnWidths = Array.from(renderedRow.cells, (cell) => cell.offsetWidth);
      tableColumns = doc.createElement("colgroup");
      content.prepend(tableColumns);
      for (const width of columnWidths) {
        const column = doc.createElement("col");
        column.style.width = `${width * getZoom()}px`;
        tableColumns.append(column);
      }
      viewport.append(content);
      const add = (column) => {
        if (
          column
            ? content.rows[0].cells.length >= 50
            : content.rows.length >= 500
        )
          return;
        const row = column ? null : content.insertRow();
        const rows = column ? Array.from(content.rows) : [row];
        let first;
        for (const item of rows) {
          const count = column ? 1 : content.rows[0].cells.length;
          for (let i = 0; i < count; i++) {
            const cell = doc.createElement(
              draft.header && item.rowIndex === 0 ? "th" : "td",
            );
            item.append(cell);
            const field = appendTableField(
              doc,
              cell,
              "",
              item.rowIndex,
              cell.cellIndex,
            );
            first ||= field;
          }
        }
        if (column && draft.alignments) draft.alignments.push("left");
        if (column) {
          columnWidths.push(104);
          tableColumns.append(doc.createElement("col"));
        }
        positionCardEditor();
        first?.focus({ preventScroll: true });
        first?.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      const column = button("Add column", "+", () => add(true));
      const row = button("Add row", "+", () => add(false));
      column.className = "rea-table-add-column";
      row.className = "rea-table-add-row";
      grid.append(viewport, column, row);
      body.append(grid);
      const menu = doc.createElement("div");
      menu.className = "rea-table-actions";
      menu.hidden = true;
      body.append(menu);
      let selectedRow = 0,
        selectedColumn = 0;
      grid.addEventListener("pointerdown", () => (menu.hidden = true));
      const limits = (axis) =>
        axis === "row"
          ? {
              index: selectedRow,
              count: content.rows.length,
              start: draft.header ? 1 : 0,
            }
          : {
              index: selectedColumn,
              count: content.rows[0].cells.length,
              start: 0,
            };
      const allowed = (axis, step) => {
        const { index, count, start } = limits(axis);
        return step
          ? index >= start && index + step >= start && index + step < count
          : count > 1;
      };
      const editStructure = (axis, step) => {
        if (!allowed(axis, step)) return;
        draft.rows = Array.from(content.rows, (row) =>
          Array.from(row.cells, (cell) => cell.firstElementChild.value),
        );
        const { index, count } = limits(axis);
        const move = (items) => {
          const [value] = items.splice(index, 1);
          if (step) items.splice(index + step, 0, value);
        };
        if (axis === "row") {
          move(draft.rows);
          selectedRow = step ? index + step : Math.min(index, count - 2);
        } else {
          draft.rows.forEach(move);
          if (draft.alignments) move(draft.alignments);
          move(columnWidths);
          if (!step) tableColumns.lastElementChild.remove();
          selectedColumn = step ? index + step : Math.min(index, count - 2);
        }
        content = cardContent(doc, draft, renderMath, true);
        content.prepend(tableColumns);
        viewport.replaceChildren(content);
        menu.hidden = true;
        positionCardEditor();
        const field =
          content.rows[selectedRow].cells[selectedColumn].firstElementChild;
        field.focus({ preventScroll: true });
        field.scrollIntoView({ block: "nearest", inline: "nearest" });
      };
      viewport.addEventListener("focusin", (event) => {
        const cell = event.target.closest("td,th");
        if (!cell) return;
        selectedRow = cell.parentElement.rowIndex;
        selectedColumn = cell.cellIndex;
      });
      const rails = doc.createElement("div");
      rails.className = "rea-table-handle-rails";
      grid.append(rails);
      let reorder;
      const items = (axis) =>
        axis === "row"
          ? Array.from(content.rows)
          : Array.from(content.rows[0].cells);
      refreshTableHandles = () => {
        if (reorder) return;
        rails.replaceChildren();
        const area = viewport.getBoundingClientRect();
        for (const axis of ["row", "column"]) {
          items(axis).forEach((item, index) => {
            const fixedHeader = axis === "row" && draft.header && index === 0;
            const rect = item.getBoundingClientRect();
            const at =
              axis === "row"
                ? (rect.top + rect.bottom) / 2 - area.top
                : (rect.left + rect.right) / 2 - area.left;
            if (at < 8 || at > (axis === "row" ? area.height : area.width) - 8)
              return;
            const handle = button(
              `Drag ${axis} ${index + 1}`,
              axis === "row" ? "≡" : "⋮",
              () => {},
            );
            handle.className = "rea-table-drag-" + axis;
            handle.style.setProperty(
              axis === "row" ? "top" : "left",
              `${at}px`,
            );
            handle.addEventListener("contextmenu", (event) => {
              event.preventDefault();
              event.stopPropagation();
              if (axis === "row") selectedRow = index;
              else selectedColumn = index;
              const label = "Delete " + axis;
              const remove = button(label, label, () => editStructure(axis, 0));
              remove.disabled = !allowed(axis, 0);
              menu.replaceChildren(remove);
              menu.hidden = false;
              const bounds = body.getBoundingClientRect();
              menu.style.left = `${Math.max(0, Math.min(bounds.width - menu.offsetWidth, event.clientX - bounds.left))}px`;
              menu.style.top = `${Math.max(0, event.clientY - bounds.top)}px`;
            });
            handle.addEventListener("pointerdown", (event) => {
              if (event.button !== 0 || fixedHeader) return;
              event.preventDefault();
              handle.setPointerCapture(event.pointerId);
              reorder = { index, target: index };
            });
            const update = (event) => {
              if (!reorder) return;
              const byRow = axis === "row";
              const candidates = items(axis);
              const coordinate = byRow ? event.clientY : event.clientX;
              const found = candidates.findIndex(
                (entry) =>
                  coordinate <
                  entry.getBoundingClientRect()[byRow ? "bottom" : "right"],
              );
              reorder.target = Math.max(
                byRow && draft.header ? 1 : 0,
                found < 0 ? candidates.length - 1 : found,
              );
              for (const entry of candidates)
                entry.classList.remove(
                  "rea-table-drop-before",
                  "rea-table-drop-after",
                );
              if (reorder.target !== index)
                candidates[reorder.target].classList.add(
                  reorder.target < index
                    ? "rea-table-drop-before"
                    : "rea-table-drop-after",
                );
            };
            const finish = (event) => {
              if (!reorder) return;
              if (event.type === "pointerup") update(event);
              const step =
                event.type === "pointerup" ? reorder.target - index : 0;
              reorder = undefined;
              for (const entry of items(axis))
                entry.classList.remove(
                  "rea-table-drop-before",
                  "rea-table-drop-after",
                );
              if (step) {
                if (axis === "row") selectedRow = index;
                else selectedColumn = index;
                editStructure(axis, step);
              } else refreshTableHandles();
            };
            handle.addEventListener("pointermove", update);
            handle.addEventListener("pointerup", finish);
            handle.addEventListener("lostpointercapture", finish);
            rails.append(handle);
          });
        }
      };
      viewport.addEventListener("scroll", refreshTableHandles);
      viewport.addEventListener("input", refreshTableHandles);
      viewport.addEventListener("keydown", (event) => {
        if (
          event.key !== "Enter" ||
          event.shiftKey ||
          event.metaKey ||
          event.ctrlKey ||
          event.isComposing
        )
          return;
        const cell = event.target.closest("td,th");
        if (!cell) return;
        event.preventDefault();
        const next =
          content.rows[cell.parentElement.rowIndex + 1]?.cells[cell.cellIndex]
            ?.firstElementChild;
        if (next) next.focus();
        else add(false);
      });
    } else {
      panel.classList.add("rea-source-card-editor");
      content.wrap = "off";
      content.placeholder =
        draft.type === "latex" ? "\\frac{a}{b}" : "Enter code";
      body.append(content);
      if (draft.type === "code") {
        const language = doc.createElement("input");
        language.className = "rea-code-language";
        language.setAttribute("aria-label", "Code language");
        language.placeholder = "Language";
        language.maxLength = 40;
        language.value = draft.language;
        language.addEventListener(
          "input",
          () => (draft.language = language.value.trim()),
        );
        title.textContent = "Code";
        toolbar.insertBefore(language, title.nextSibling);
      }
      if (draft.type === "latex" && renderMath) {
        const preview = doc.createElement("div");
        preview.className = "rea-card-equation-preview";
        preview.setAttribute("aria-label", "Equation preview");
        const refresh = () =>
          preview.replaceChildren(
            cardContent(doc, { ...draft, source: content.value }, renderMath),
          );
        content.addEventListener("input", () => {
          win.clearTimeout(previewFrame);
          previewFrame = win.setTimeout(refresh, 120);
        });
        refresh();
        body.append(preview);
      }
    }
    root.append(panel);
    node.el.classList.add("rea-card-is-editing");
    selectCard(node.id);
    positionCardEditor = () => {
      const anchor = toLocal({
        x: node.x - node.width / 2,
        y: node.y - node.height / 2,
      });
      let desiredWidth = Math.max(230, node.width * getZoom());
      if (columnWidths) {
        const widths = columnWidths.map((column) =>
          Math.max(76, column * getZoom()),
        );
        widths.forEach((width, index) => {
          tableColumns.children[index].style.width = `${width}px`;
        });
        const gridWidth = widths.reduce((sum, width) => sum + width, 0) + 2;
        content.style.width = `${gridWidth}px`;
        desiredWidth = gridWidth + 31;
      }
      const width = Math.min(canvas.clientWidth - 24, desiredWidth);
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(12, Math.min(canvas.clientWidth - width - 12, anchor.x))}px`;
      panel.style.top = `${Math.max(8, Math.min(canvas.clientHeight - panel.offsetHeight - 12, anchor.y - (toolbar.isConnected ? toolbar.offsetHeight + 6 : 0)))}px`;
      refreshTableHandles?.();
    };
    const saveOnDoubleClickAway = (event) => {
      if (panel.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      panel.requestSubmit();
    };
    root.addEventListener("dblclick", saveOnDoubleClickAway, {
      capture: true,
      signal,
    });
    closeCardEditor = () => {
      root.removeEventListener("dblclick", saveOnDoubleClickAway, true);
      win.clearTimeout(previewFrame);
      panel.remove();
      node.el.classList.remove("rea-card-is-editing");
      closeCardEditor = undefined;
      positionCardEditor = undefined;
      selectionControls();
      canvas.focus();
    };
    selectionControls();
    positionCardEditor();
    panel.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") closeCardEditor();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        panel.requestSubmit();
      }
    });
    panel.addEventListener("submit", (event) => {
      event.preventDefault();
      if (draft.type === "table")
        draft.rows = Array.from(content.rows, (row) =>
          Array.from(row.cells, (cell) => cell.firstElementChild.value),
        );
      else draft.source = content.value;
      if (!validCard(draft)) {
        status("Check the language label and card size.", true);
        return;
      }
      closeCardEditor();
      if (JSON.stringify(draft) === original) return;
      change((next) => {
        const item = next.nodes.find((n) => n.id === node.id);
        if (item) {
          item.card = draft;
          item.label = cardTitle(draft);
          item.size = cardNode(draft).size;
        }
      });
    });
    if (draft.type === "table")
      content.rows[row]?.cells[column]?.firstElementChild.focus();
    else content.focus();
  }
  return {
    editCard,
    get active() {
      return !!closeCardEditor;
    },
    close() {
      closeCardEditor?.();
    },
    position() {
      positionCardEditor?.();
    },
  };
}
