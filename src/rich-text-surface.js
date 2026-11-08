import { inlineRuns } from "./text-format.js";
/** Safe DOM <-> Markdown seam. No pasted HTML or executable markup enters the document. */
export function createRichSurface(
  doc,
  { value, resolveTitle, alignment = "center", getAlignments },
) {
  const input = doc.createElement("div");
  input.contentEditable = "true";
  input.className = "rea-live-surface";
  input.setAttribute("role", "textbox");
  input.setAttribute("aria-multiline", "true");
  input.spellcheck = true;
  const selection = () => doc.defaultView.getSelection();
  function snapshot() {
    let source = "";
    const points = [],
      ends = new Map(),
      links = [];
    const text = (node) => {
      const offsets = [];
      for (let i = 0; i < node.data.length; i++) {
        offsets.push(source.length);
        if (
          node.data[i] !== "\u200b" ||
          !node.parentElement.closest("[data-caret-placeholder]")
        )
          source += node.data[i];
      }
      offsets.push(source.length);
      points.push({ node, offsets });
    };
    const walk = (node) => {
      if (node.nodeType === 3) {
        text(node);
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName,
        mark = {
          STRONG: "**",
          B: "**",
          EM: "*",
          I: "*",
          MARK: "==",
          CODE: "`",
        }[tag];
      if (tag === "BR") {
        source += "\n";
        return;
      }
      if (node.dataset.textLink) {
        const linkStart = source.length;
        const target = node.dataset.textLink,
          plain = node.textContent;
        if (node.dataset.internal === "true") {
          if (
            node.dataset.wikiAlias !== "true" &&
            plain === node.dataset.originalTitle
          ) {
            const start =
              source.length + 2 + Math.max(0, target.lastIndexOf("/") + 1);
            source += "[[" + target + "]]";
            const walker = doc.createTreeWalker(node, 4);
            let textNode,
              at = 0;
            while ((textNode = walker.nextNode())) {
              const offsets = [];
              for (let i = 0; i <= textNode.data.length; i++)
                offsets.push(Math.min(source.length - 2, start + at + i));
              points.push({ node: textNode, offsets });
              ends.set(textNode, source.length);
              at += textNode.data.length;
            }
          } else {
            source += "[[" + target + "|";
            for (const child of node.childNodes) walk(child);
            source += "]]";
          }
        } else {
          source += "[";
          for (const child of node.childNodes) walk(child);
          source += "](" + target + ")";
        }
        links.push({
          node,
          start: linkStart,
          end: source.length,
          target,
          internal: node.dataset.internal === "true",
          label: plain,
        });
        for (const p of points)
          if (node.contains(p.node)) ends.set(p.node, source.length);
        return;
      }
      const emitMark =
        mark &&
        !(
          node.dataset.caretPlaceholder &&
          node.textContent.replaceAll("\u200b", "") === ""
        );
      if (emitMark) source += mark;
      const children = [...node.childNodes];
      children.forEach((child, i) => {
        if (
          i &&
          child.nodeType === 1 &&
          ["DIV", "P", "LI"].includes(child.tagName) &&
          !source.endsWith("\n")
        )
          source += "\n";
        walk(child);
      });
      if (emitMark) source += mark;
      if (mark)
        for (const p of points)
          if (node.contains(p.node)) ends.set(p.node, source.length);
    };
    [...input.childNodes].forEach((node, i) => {
      if (i) source += "\n";
      if (
        node.nodeType === 1 &&
        node.childNodes.length === 1 &&
        node.firstChild.nodeName === "BR"
      )
        return;
      walk(node);
    });
    return { source, points, ends, links };
  }
  function sourceOffset(node, offset, snap, collapsed) {
    const p = snap.points.find((p) => p.node === node);
    if (p)
      return collapsed && offset === node.data.length && snap.ends.has(node)
        ? snap.ends.get(node)
        : p.offsets[Math.min(offset, p.offsets.length - 1)];
    if (node === input) return offset === 0 ? 0 : snap.source.length;
    const child = node?.childNodes?.[offset];
    const next = snap.points.find(
      (p) => child && (child === p.node || child.contains?.(p.node)),
    );
    if (next) return next.offsets[0];
    const inside = snap.points.filter((p) => node?.contains?.(p.node));
    return inside.length ? inside.at(-1).offsets.at(-1) : snap.source.length;
  }
  function getRange() {
    const sel = selection(),
      snap = snapshot();
    if (
      !sel?.rangeCount ||
      !input.contains(sel.anchorNode) ||
      !input.contains(sel.focusNode)
    )
      return { start: 0, end: snap.source.length };
    const r = sel.getRangeAt(0);
    return {
      start: sourceOffset(r.startContainer, r.startOffset, snap, r.collapsed),
      end: sourceOffset(r.endContainer, r.endOffset, snap, r.collapsed),
    };
  }
  function setRange(start, end) {
    const snap = snapshot();
    if (!snap.points.length) {
      const r = doc.createRange();
      r.selectNodeContents(input);
      r.collapse(true);
      selection().removeAllRanges();
      selection().addRange(r);
      return;
    }
    const at = (offset) => {
      let best = null,
        distance = Infinity;
      for (const p of snap.points)
        for (let i = 0; i < p.offsets.length; i++) {
          const d = Math.abs(p.offsets[i] - offset);
          if (d < distance) {
            best = { node: p.node, offset: i };
            distance = d;
          }
        }
      return best;
    };
    const a = at(start),
      b = at(end),
      r = doc.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    selection().removeAllRanges();
    selection().addRange(r);
  }
  function render(source) {
    input.replaceChildren();
    source.split("\n").forEach((text, i) => {
      const p = doc.createElement("div");
      p.dataset.paragraph = String(i);
      p.style.textAlign = getAlignments?.()[i] || alignment;
      for (const run of inlineRuns(text, resolveTitle)) {
        let el = doc.createTextNode(run.text);
        if (run.link) {
          const a = doc.createElement("a");
          a.dataset.textLink = run.link;
          a.dataset.internal = String(run.internal);
          a.dataset.wikiAlias = String(source.includes("[[" + run.link + "|"));
          a.dataset.originalTitle = run.text;
          a.setAttribute("role", "link");
          a.append(el);
          el = a;
        }
        for (const [flag, tag] of [
          ["code", "code"],
          ["highlight", "mark"],
          ["italic", "em"],
          ["bold", "strong"],
        ])
          if (run[flag]) {
            const parent = doc.createElement(tag);
            parent.append(el);
            el = parent;
          }
        p.append(el);
      }
      if (!p.childNodes.length) p.append(doc.createElement("br"));
      input.append(p);
    });
  }
  Object.defineProperties(input, {
    value: { get: () => snapshot().source, set: render },
    linkAtSelection: {
      value: () => {
        const sel = selection();
        return snapshot().links.find((l) => l.node.contains(sel?.anchorNode));
      },
    },
    pendingMark: {
      value: (tag, selector) => {
        const sel = selection();
        if (!sel?.rangeCount) return;
        const r = sel.getRangeAt(0),
          el =
            sel.anchorNode.nodeType === 3
              ? sel.anchorNode.parentElement
              : sel.anchorNode,
          active = el.closest?.(selector);
        let holder;
        if (active && input.contains(active)) {
          const tail = doc.createRange();
          tail.selectNodeContents(active);
          tail.setStart(r.startContainer, r.startOffset);
          const rest = tail.extractContents(),
            after = active.cloneNode(false);
          after.append(rest);
          holder = doc.createElement("span");
          active.after(holder);
          if (after.textContent) holder.after(after);
        } else {
          holder = doc.createElement(tag);
          r.deleteContents();
          r.insertNode(holder);
        }
        holder.dataset.caretPlaceholder = "true";
        const caret = doc.createTextNode("\u200b");
        holder.append(caret);
        const next = doc.createRange();
        next.setStart(caret, 1);
        next.collapse(true);
        sel.removeAllRanges();
        sel.addRange(next);
      },
    },
    activeMark: {
      value: (selector) => {
        const range = getRange(),
          snap = snapshot();
        let points = snap.points.filter(
          (p) => p.offsets[0] < range.end && p.offsets.at(-1) > range.start,
        );
        if (!points.length)
          points = snap.points.filter(
            (p) =>
              p.offsets[0] <= range.start && p.offsets.at(-1) >= range.start,
          );
        return (
          points.length > 0 &&
          points.every((p) => {
            const mark = p.node.parentElement.closest(selector);
            return mark && input.contains(mark);
          })
        );
      },
    },
    selectionStart: { get: () => getRange().start },
    selectionEnd: { get: () => getRange().end },
    setSelectionRange: { value: setRange },
    select: {
      value: () => {
        const r = doc.createRange();
        r.selectNodeContents(input);
        selection().removeAllRanges();
        selection().addRange(r);
      },
    },
  });
  render(value);
  return {
    input,
    normalize: () => {
      const r = getRange(),
        s = snapshot().source;
      render(s);
      setRange(r.start, r.end);
    },
    refreshAlignment: () => {
      [...input.children].forEach(
        (p, i) => (p.style.textAlign = getAlignments?.()[i] || alignment),
      );
    },
  };
}
