/** The popup reads the source range at the caret. It never owns the draft. */
export function inlineLinkPicker({
  doc,
  input,
  wrapper,
  suggest,
  replace,
  on,
  signal,
  rawLink,
}) {
  const panel = doc.createElement("div");
  panel.className = "rea-inline-link-picker rea-popover";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Internal link suggestions");
  wrapper.append(panel);
  let request = 0,
    rows = [],
    index = 0,
    active,
    dismissed,
    busy = false,
    stagedAlias;
  const close = () => {
    request++;
    active = null;
    panel.hidden = true;
    stagedAlias = undefined;
    input.removeAttribute("aria-activedescendant");
    input.removeAttribute("aria-controls");
  };
  const read = () => {
    let end = input.selectionEnd;
    if (end !== input.selectionStart) return null;
    const raw = rawLink?.();
    if (
      raw &&
      end === raw.end - 1 &&
      input.value.slice(end - 1, end + 1) === "]]"
    )
      end--;
    const match = /\[\[([^[\]\n]*)$/.exec(input.value.slice(0, end));
    if (!match) return null;
    const inside = raw && raw.start === match.index && end <= raw.end;
    const alias = inside
      ? input.value.slice(raw.start, raw.end).match(/\|([^\]\n]+)\]\]$/)?.[1]
      : undefined;
    return {
      start: match.index,
      alias,
      end: inside
        ? raw.end
        : end + (input.value.slice(end, end + 2) === "]]" ? 2 : 0),
      query: match[1],
    };
  };
  function insert(range, text) {
    const at = range.start + text.length;
    replace({
      value:
        input.value.slice(0, range.start) + text + input.value.slice(range.end),
      start: at,
      end: at,
    });
  }
  async function choose(row) {
    if (!active || !row || busy) return;
    const range = active,
      draft = input.value;
    busy = true;
    try {
      const target = row.resolve ? await row.resolve() : row.target;
      if (signal.aborted || input.value !== draft) return;
      const alias =
        range.query.split("|")[1]?.trim() || range.alias || row.alias;
      close();
      insert(range, "[[" + target + (alias ? "|" + alias : "") + "]]");
    } catch (error) {
      panel.textContent = error.message;
    } finally {
      busy = false;
    }
  }
  function extend(suffix) {
    if (!active || busy) return;
    const row = rows[index];
    const base = row?.target || active.query.split("|")[0];
    stagedAlias = suffix === "|" && row?.resolve ? { base, row } : undefined;
    const target = suffix === "|" ? base : base.split("#")[0];
    if (!target) return;
    insert(active, "[[" + target + suffix);
    refresh();
  }
  function draw() {
    panel.replaceChildren();
    const actions = doc.createElement("div");
    actions.className = "rea-link-actions";
    for (const [suffix, label] of [
      ["#", "Heading"],
      ["#^", "Block"],
      ["|", "Display text"],
    ]) {
      const button = doc.createElement("button");
      button.type = "button";
      button.textContent =
        suffix === "#^" ? "^ " + label : suffix + " " + label;
      button.dataset.suffix = suffix;
      actions.append(button);
    }
    panel.append(actions);
    const list = doc.createElement("div");
    list.className = "rea-link-results";
    list.setAttribute("role", "listbox");
    list.id = input.id + "-link-results";
    input.setAttribute("aria-controls", list.id);
    for (const [i, row] of rows.entries()) {
      const button = doc.createElement("button");
      button.type = "button";
      button.setAttribute("role", "option");
      button.id = list.id + "-" + i;
      button.setAttribute("aria-selected", String(i === index));
      button.textContent = row.label;
      if (row.detail) {
        const detail = doc.createElement("small");
        detail.textContent = row.detail;
        button.append(detail);
      }
      button.dataset.row = i;
      list.append(button);
    }
    if (!rows.length) list.textContent = "No matching links";
    panel.append(list);
    syncSelection();
    const caret = doc.getSelection()?.rangeCount
      ? doc.getSelection().getRangeAt(0).getBoundingClientRect()
      : null;
    const field = input.getBoundingClientRect();
    const host = wrapper.getBoundingClientRect();
    const board = wrapper.parentElement.getBoundingClientRect();
    const x = Math.max(
      board.left + 8,
      Math.min(caret?.left || field.left, board.right - panel.offsetWidth - 8),
    );
    const below = caret?.bottom || field.bottom;
    const y =
      below + panel.offsetHeight + 6 <= board.bottom
        ? below + 6
        : Math.max(
            board.top + 8,
            (caret?.top || field.top) - panel.offsetHeight - 6,
          );
    panel.style.left = `${x - host.left}px`;
    panel.style.top = `${y - host.top}px`;
  }
  function syncSelection(previous) {
    const list = panel.querySelector(".rea-link-results");
    const selected = list?.children[index];
    if (!selected) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    list.children[previous]?.setAttribute("aria-selected", "false");
    selected.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", selected.id);
    const top = selected.offsetTop;
    const bottom = top + selected.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight;
  }
  function refresh() {
    if (busy) return;
    const range = read();
    if (!range || range.query === dismissed || doc.activeElement !== input) {
      if (!range) dismissed = undefined;
      close();
      return;
    }
    if (active?.start === range.start && active.query === range.query) return;
    active = range;
    rows = [];
    index = 0;
    panel.hidden = false;
    panel.textContent = "Finding links…";
    const token = ++request;
    const [target, alias] = range.query.split("|");
    Promise.resolve()
      .then(() =>
        alias !== undefined
          ? target
            ? [
                {
                  ...(stagedAlias?.base === target ? stagedAlias.row : {}),
                  target,
                  label: alias || target,
                  detail: target,
                },
              ]
            : []
          : suggest(target),
      )
      .then((results) => {
        if (signal.aborted || token !== request) return;
        rows = results;
        draw();
      })
      .catch(() => {
        if (!signal.aborted && token === request)
          panel.textContent = "Could not load links. Keep typing to retry.";
      });
  }
  on(panel, "pointerdown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  on(panel, "click", (e) => {
    const button = e.target.closest("button");
    if (button?.dataset.suffix) extend(button.dataset.suffix);
    else if (button?.dataset.row !== undefined)
      void choose(rows[Number(button.dataset.row)]);
  });
  on(panel, "wheel", (e) => e.stopPropagation());
  return {
    refresh,
    close,
    keydown(e) {
      if (!active) return false;
      if (busy) {
        e.preventDefault();
        return true;
      }
      if (e.key === "Escape") {
        dismissed = active.query;
        close();
      } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        const previous = index;
        if (rows.length)
          index =
            (index + rows.length + (e.key === "ArrowDown" ? 1 : -1)) %
            rows.length;
        syncSelection(previous);
      } else if (e.key === "Enter" && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        if (!rows[index] && rawLink?.()) return false;
        void choose(rows[index]);
      } else if (
        e.key === "Tab" &&
        rows[index]?.target &&
        !active.query.includes("|")
      ) {
        insert(active, "[[" + rows[index].target);
        refresh();
      } else if (
        ["#", "^", "|"].includes(e.key) &&
        (rows[index]?.target || (e.key === "|" && rows[index]?.resolve)) &&
        !active.query.includes("|")
      ) {
        extend(e.key === "^" ? "#^" : e.key);
      } else return false;
      e.preventDefault();
      return true;
    },
  };
}
