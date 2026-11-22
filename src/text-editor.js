import { icon } from "./icons.js";
import { setMarkup } from "./markup.js";
import { inlineLinkPicker } from "./inline-link-picker.js";
import { createRichSurface } from "./rich-text-surface.js";
import {
  ALIGNMENTS,
  characterCount,
  wrapSelection,
  paragraphRange,
  listLines,
  outlineStyles,
  indentList,
  continueList,
} from "./text-format.js";
let editorSequence = 0;
/** An editor session owns its transient draft and selection; blur never commits. */
export function createTextEditor({
  doc,
  root,
  signal,
  value,
  alignments = [],
  alignment = "center",
  outlineStyle,
  fontSize = 16,
  getPreferences,
  onCommit,
  onCancel,
  onDraft,
  label = "Shape text",
  surfaceHost,
  resolveTitle,
  onExpand,
  onOpenLink,
  suggestLinks,
}) {
  const localAbort = new doc.defaultView.AbortController();
  const abortEditor = () => localAbort.abort();
  signal.addEventListener("abort", abortEditor, { once: true });
  const wrapper = doc.createElement("div");
  wrapper.className = "rea-text-edit";
  let lineAlignments = [...alignments];
  const surface = createRichSurface(doc, {
    value,
    resolveTitle,
    onExpand,
    onOpenLink,
    alignment,
    getAlignments: () => lineAlignments,
    getOutlineStyle: () => outlineStyle,
    setOutlineStyle: (style) => (outlineStyle = style),
  });
  const input = surface.input;
  input.id = `rea-text-editor-${++editorSequence}`;
  const inputLabel = doc.createElement("span");
  inputLabel.id = input.id + "-label";
  inputLabel.className = "rea-sr-only";
  inputLabel.textContent = label;
  input.setAttribute("aria-labelledby", inputLabel.id);
  const tools = doc.createElement("div");
  tools.className = "rea-text-tools rea-popover";
  tools.setAttribute("role", "toolbar");
  tools.setAttribute("aria-label", "Text formatting");
  const footer = doc.createElement("div");
  footer.className = "rea-text-footer";
  const counter = doc.createElement("span");
  counter.className = "rea-character-count";
  counter.setAttribute("aria-live", "polite");
  const overflow = doc.createElement("button");
  overflow.type = "button";
  overflow.className = "rea-text-overflow";
  overflow.textContent = "›";
  overflow.setAttribute("aria-label", "Expand text editor");
  footer.append(counter, overflow);
  wrapper.append(inputLabel, tools, footer);
  (surfaceHost || wrapper).append(input);
  root.append(wrapper);
  let selected = { start: 0, end: value.length },
    expanded = false;
  let previousValue = value,
    history = [
      { value, alignments: [...alignments], start: 0, end: value.length },
    ],
    historyIndex = 0,
    restoring = false;
  const on = (el, name, fn, options = {}) =>
    el.addEventListener(name, fn, { ...options, signal: localAbort.signal });
  const remember = () => {
    selected = { start: input.selectionStart, end: input.selectionEnd };
    syncAlignment();
  };
  const update = () => {
    if (previousValue !== input.value) {
      let prefix = 0,
        suffix = 0;
      while (
        prefix < previousValue.length &&
        prefix < input.value.length &&
        previousValue[prefix] === input.value[prefix]
      )
        prefix++;
      while (
        suffix < previousValue.length - prefix &&
        suffix < input.value.length - prefix &&
        previousValue[previousValue.length - 1 - suffix] ===
          input.value[input.value.length - 1 - suffix]
      )
        suffix++;
      const line = previousValue.slice(0, prefix).split("\n").length - 1;
      const removed =
        previousValue.slice(prefix, previousValue.length - suffix).split("\n")
          .length - 1;
      const added =
        input.value.slice(prefix, input.value.length - suffix).split("\n")
          .length - 1;
      if (removed || added)
        lineAlignments.splice(
          line + 1,
          removed,
          ...Array(added).fill(lineAlignments[line] || alignment),
        );
      previousValue = input.value;
    }
    onDraft?.(input.value, input, Number.parseFloat(input.style.fontSize));
    const prefs = getPreferences(),
      count = characterCount(input.innerText.replaceAll("\u200b", ""));
    counter.hidden = !prefs.counterEnabled;
    counter.textContent = `${count} / ${prefs.characterTarget}`;
    counter.classList.toggle("rea-over-target", count > prefs.characterTarget);
    counter.setAttribute(
      "aria-label",
      `${count} characters, target ${prefs.characterTarget}. ${Math.max(0, prefs.characterTarget - count)} remaining.`,
    );
    overflow.hidden = !expanded && input.scrollHeight <= input.clientHeight + 2;
    overflow.textContent = expanded ? "‹" : "›";
    overflow.setAttribute("aria-expanded", String(expanded));
    overflow.setAttribute(
      "aria-label",
      expanded ? "Collapse text editor" : "Expand text editor",
    );
    const box = wrapper.getBoundingClientRect(),
      host = root.getBoundingClientRect(),
      toolWidth = tools.offsetWidth;
    const center = Math.max(
      host.left + toolWidth / 2 + 12,
      Math.min(host.right - toolWidth / 2 - 12, box.left + box.width / 2),
    );
    tools.style.left = `${center - box.left}px`;
    if (!restoring) {
      const last = history[historyIndex];
      if (
        last.value !== input.value ||
        JSON.stringify(last.alignments) !== JSON.stringify(lineAlignments)
      ) {
        history = history.slice(0, historyIndex + 1);
        history.push({
          value: input.value,
          alignments: [...lineAlignments],
          start: input.selectionStart,
          end: input.selectionEnd,
        });
        historyIndex++;
        if (history.length > 100) {
          history.shift();
          historyIndex--;
        }
      }
    }
    syncAlignment();
  };
  const replace = (result) => {
    input.value = result.value;
    input.focus();
    input.setSelectionRange(result.start, result.end);
    remember();
    update();
  };
  const wrap = (left, right = left) => {
    const { start, end } = selected,
      s = input.value;
    const mark = {
      "**": ["strong", "strong,b"],
      "*": ["em", "em,i"],
      "==": ["mark", "mark"],
    }[left];
    if (start === end && mark) {
      input.pendingMark(...mark);
      input.focus();
      remember();
      update();
      return;
    }

    if (
      input.activeMark(
        { "**": "strong,b", "*": "em,i", "==": "mark" }[left] ||
          "nonexistent-mark",
      ) &&
      s.slice(start - left.length, start) === left &&
      s.slice(end, end + right.length) === right
    )
      replace({
        value:
          s.slice(0, start - left.length) +
          s.slice(start, end) +
          s.slice(end + right.length),
        start: start - left.length,
        end: end - left.length,
      });
    else replace(wrapSelection(s, start, end, left, right));
  };
  const action = (label, text, fn) => {
    const b = doc.createElement("button");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.title = label;
    b.textContent = text;
    on(b, "pointerdown", (e) => {
      e.preventDefault();
      remember();
    });
    on(b, "click", (e) => {
      e.stopPropagation();
      fn();
    });
    tools.append(b);
    return b;
  };
  action("Bold", "B", () => wrap("**"));
  action("Italic", "𝘐", () => wrap("*"));
  action("Highlight", "▰", () => wrap("=="));
  action("Numbered list", "1.", () => {
    outlineStyle = undefined;
    input.value = listLines(input.value, selected.start, selected.end, true);
    input.focus();
    update();
  });
  const outlineControl = doc.createElement("select");
  outlineControl.className = "rea-outline-style";
  outlineControl.setAttribute("aria-label", "Outline numbering style");
  const prompt = doc.createElement("option");
  prompt.value = "";
  prompt.textContent = "Outline";
  prompt.disabled = true;
  outlineControl.append(prompt);
  for (const style of outlineStyles) {
    const option = doc.createElement("option");
    option.value = style.id;
    option.textContent = style.icon + " · " + style.label;
    outlineControl.append(option);
  }
  outlineControl.value = "";
  on(outlineControl, "pointerdown", remember);
  on(outlineControl, "keydown", (event) => event.stopPropagation());
  on(outlineControl, "change", () => {
    outlineStyle = outlineControl.value;
    outlineControl.value = "";
    const value = listLines(
      input.value,
      selected.start,
      selected.end,
      true,
      outlineStyle,
    );
    const { last } = paragraphRange(input.value, selected.start, selected.end);
    const caret = value
      .split("\n")
      .slice(0, last + 1)
      .join("\n").length;
    replace({ value, start: caret, end: caret });
  });
  tools.append(outlineControl);
  action("Bullet list", "•", () => {
    input.value = listLines(input.value, selected.start, selected.end, false);
    input.focus();
    update();
  });
  const picker = inlineLinkPicker({
    doc,
    input,
    wrapper,
    replace,
    on,
    suggest: suggestLinks,
    rawLink: surface.rawLink,
    signal: localAbort.signal,
  });
  let linkPanel = null;
  function editWebLink() {
    linkPanel?.remove();
    remember();
    picker.close();
    const link = input.linkAtSelection();
    const existing = link?.internal ? null : link,
      range = existing
        ? { start: existing.start, end: existing.end }
        : selected;
    const text =
      existing?.label || input.value.slice(range.start, range.end) || "Link";
    const panel = doc.createElement("div");
    panel.className = "rea-live-link-panel rea-popover";
    linkPanel = panel;
    const target = doc.createElement("input");
    target.setAttribute("aria-label", "Link target");
    target.placeholder = "https://example.com";
    target.value = existing?.target || "https://";
    const apply = doc.createElement("button");
    apply.textContent = "✓";
    apply.setAttribute("aria-label", "Apply link");
    const save = () => {
      const url = target.value.trim();
      const valid = /^(https?:\/\/[^\s)]+|mailto:[^\s)]+)$/.test(url);
      target.setAttribute("aria-invalid", String(!valid));
      if (!valid) return;
      const markup = `[${text}](${url})`;
      const old = input.value;
      panel.remove();
      linkPanel = null;
      replace({
        value: old.slice(0, range.start) + markup + old.slice(range.end),
        start: range.start,
        end: range.start + markup.length,
      });
    };
    on(panel, "pointerdown", (e) => e.stopPropagation());
    on(apply, "click", save);
    on(target, "keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      }
      if (e.key === "Escape") {
        panel.remove();
        linkPanel = null;
        input.focus();
      }
    });
    panel.append(target, apply);
    wrapper.append(panel);
    target.focus();
    target.select();
  }
  const sizeControl = doc.createElement("select");
  sizeControl.className = "rea-text-size";
  sizeControl.setAttribute("aria-label", "Text size");
  sizeControl.title = "Text size (px)";
  for (const size of [
    ...new Set([10, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, fontSize]),
  ].sort((a, b) => a - b)) {
    const option = doc.createElement("option");
    option.value = String(size);
    option.textContent = size + " px";
    sizeControl.append(option);
  }
  const setFontSize = (size) => {
    sizeControl.value = String(size);
    input.style.fontSize = size + "px";
    input.style.lineHeight = Math.ceil(size * 1.4) + "px";
  };
  setFontSize(fontSize);
  on(sizeControl, "pointerdown", remember);
  on(sizeControl, "keydown", (event) => event.stopPropagation());
  on(sizeControl, "change", () => {
    setFontSize(Number(sizeControl.value));
    input.focus();
    input.setSelectionRange(selected.start, selected.end);
    update();
  });
  tools.append(sizeControl);
  const alignmentButtons = new Map();
  const alignmentGroup = doc.createElement("div");
  alignmentGroup.className = "rea-text-alignment";
  alignmentGroup.setAttribute("role", "group");
  alignmentGroup.setAttribute("aria-label", "Text alignment");
  for (const choice of ALIGNMENTS) {
    const b = action("Align " + choice, "", () => {
      const { first, last } = paragraphRange(
        input.value,
        selected.start,
        selected.end,
      );
      for (let i = first; i <= last; i++) lineAlignments[i] = choice;
      input.focus();
      input.setSelectionRange(selected.start, selected.end);
      update();
    });
    setMarkup(b, icon("align-" + choice));
    alignmentButtons.set(choice, b);
    alignmentGroup.append(b);
  }
  tools.append(alignmentGroup);
  function syncAlignment() {
    const { first } = paragraphRange(
      input.value,
      input.selectionStart,
      input.selectionEnd,
    );
    const current = lineAlignments[first] || alignment;
    for (const [choice, b] of alignmentButtons)
      b.setAttribute("aria-pressed", String(choice === current));
    surface.refreshAlignment();
  }
  function refreshLinks(clickedLink) {
    surface.revealLinkAtCaret(clickedLink);
    const raw = surface.rawLink();
    if (
      raw &&
      raw.node.textContent === raw.node.dataset.rawLink &&
      !/\[\[[^|\]]*\^/.test(raw.node.textContent)
    )
      picker.close();
    else picker.refresh();
  }
  action("Save text", "✓", onCommit);
  on(doc, "selectionchange", () => {
    if (doc.activeElement === input) {
      remember();
      refreshLinks();
    }
  });
  on(input, "keyup", remember);
  on(input, "click", (e) => {
    if (e.metaKey || e.ctrlKey) return;
    refreshLinks(e.target.closest("[data-text-link]"));
    remember();
  });
  on(input, "input", (e) => {
    if (!e.isComposing) surface.cleanPlaceholders();
    if (
      !e.isComposing &&
      e.inputType !== "insertReplacementText" &&
      e.data?.length > 1 &&
      e.data === input.textContent
    ) {
      input.value = e.data;
      input.setSelectionRange(input.value.length, input.value.length);
    } else if (
      !e.isComposing &&
      e.inputType !== "insertReplacementText" &&
      /[*_=\]`)$]/.test(e.data || "")
    )
      surface.normalize();
    remember();
    update();
    if (!e.isComposing) refreshLinks();
  });
  on(input, "compositionend", () => {
    surface.normalize();
    remember();
    update();
  });
  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return;
    remember();
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "k") {
      e.preventDefault();
      editWebLink();
      return;
    }
    if (picker.keydown(e)) return;
    if (e.key === "Tab" && !mod && !e.altKey) {
      const result = indentList(
        input.value,
        selected.start,
        selected.end,
        e.shiftKey,
        outlineStyle,
      );
      if (result) {
        e.preventDefault();
        replace(result);
        return;
      }
    }
    if (
      !mod &&
      !e.shiftKey &&
      ["ArrowLeft", "ArrowRight"].includes(e.key) &&
      surface.enterLink(e.key)
    ) {
      e.preventDefault();
      remember();
      return;
    }
    if (
      !mod &&
      !e.shiftKey &&
      e.key === "Enter" &&
      surface.finishRevealedLink()
    ) {
      e.preventDefault();
      picker.close();
      remember();
      update();
      return;
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      input.select();
      remember();
      return;
    }
    if (mod && ["Home", "End"].includes(e.key)) {
      e.preventDefault();
      const at = e.key === "Home" ? 0 : input.value.length;
      input.setSelectionRange(at, at);
      remember();
      return;
    }

    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      const next = historyIndex + (e.shiftKey ? 1 : -1);
      if (next >= 0 && next < history.length) {
        historyIndex = next;
        const h = history[next];
        restoring = true;
        input.value = h.value;
        lineAlignments = [...h.alignments];
        previousValue = h.value;
        input.setSelectionRange(h.start, h.end);
        remember();
        update();
        restoring = false;
      }
      return;
    }
    if (mod && ["b", "i"].includes(e.key.toLowerCase())) {
      e.preventDefault();
      wrap(e.key.toLowerCase() === "b" ? "**" : "*");
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === "h") {
      e.preventDefault();
      wrap("==");
      return;
    }
    const pairs = { "(": ")", "[": "]", "{": "}", '"': '"' };
    if (!mod && pairs[e.key] && selected.end > selected.start) {
      e.preventDefault();
      wrap(e.key, pairs[e.key]);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key === "Enter" && !e.isComposing) {
      const continuation =
        !mod &&
        !e.shiftKey &&
        continueList(input.value, selected.start, selected.end, outlineStyle);
      if (continuation) {
        e.preventDefault();
        replace(continuation);
        return;
      }
      if (!e.shiftKey || mod) {
        e.preventDefault();
        onCommit();
      }
    }
  };
  on(input, "keydown", handleKeyDown);
  on(
    doc.defaultView,
    "keydown",
    (e) => {
      const mod = e.metaKey || e.ctrlKey,
        key = e.key.toLowerCase();
      if (
        e.target === input &&
        mod &&
        (["a", "b", "i", "k", "z", "home", "end"].includes(key) ||
          (e.shiftKey && key === "h") ||
          key === "enter")
      )
        handleKeyDown(e);
    },
    { capture: true },
  );
  on(wrapper, "pointerdown", (e) => e.stopPropagation());
  on(wrapper, "dblclick", (e) => e.stopPropagation());
  on(input, "pointerdown", (e) => {
    e.stopPropagation();
    const link = e.target.closest("[data-text-link]");
    if (link && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onOpenLink?.(link.dataset.textLink, link.dataset.internal === "true");
    }
  });
  on(input, "copy", (e) => e.stopPropagation());
  on(input, "cut", (e) => e.stopPropagation());
  on(input, "dblclick", (e) => e.stopPropagation());
  on(input, "paste", (e) => {
    e.preventDefault();
    e.stopPropagation();
    remember();
    const text = e.clipboardData.getData("text/plain");
    replace({
      value:
        input.value.slice(0, selected.start) +
        text +
        input.value.slice(selected.end),
      start: selected.start + text.length,
      end: selected.start + text.length,
    });
  });
  on(input, "blur", () => {
    picker.close();
    surface.finishRevealedLink(false);
  });
  on(input, "wheel", (e) => e.stopPropagation());
  on(overflow, "pointerdown", (e) => e.preventDefault());
  on(overflow, "click", () => {
    if (onExpand) {
      onExpand();
      input.focus();
      update();
      return;
    }
    expanded = !expanded;
    wrapper.classList.toggle("rea-editor-expanded", expanded);
    input.focus();
    update();
  });
  wrapper.classList.add("rea-inplace-tools");
  syncAlignment();
  return {
    input,
    wrapper,
    update,
    setFontSize,
    getAlignments: () => lineAlignments,
    getOutlineStyle: () => outlineStyle,
    setOutlineStyle: (style) => (outlineStyle = style),
    remove: () => {
      localAbort.abort();
      signal.removeEventListener("abort", abortEditor);
      input.remove();
      wrapper.remove();
    },
  };
}
