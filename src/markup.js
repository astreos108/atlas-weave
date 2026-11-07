import DOMPurify from "dompurify";
/** Only sanitized fragments cross the generated-markup seam. User labels use textContent. */
export function setMarkup(element, markup) {
  element.replaceChildren(
    DOMPurify.sanitize(markup, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      ADD_ATTR: [
        "marker-end",
        "aria-label",
        "data-action",
        "data-tool",
        "data-selection",
        "data-edge",
      ],
    }),
  );
}
export function appendMarkup(element, markup) {
  element.append(
    DOMPurify.sanitize(markup, {
      RETURN_DOM_FRAGMENT: true,
      USE_PROFILES: { html: true, svg: true, svgFilters: true },
      ADD_ATTR: [
        "marker-end",
        "aria-label",
        "data-action",
        "data-tool",
        "data-selection",
        "data-edge",
      ],
    }),
  );
}
