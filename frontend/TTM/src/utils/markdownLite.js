const ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
}

function applyInlineFormatting(escapedText = "") {
  let html = escapedText;

  // Bold: **text** or __text__
  html = html.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_\n]+)__/g, "<strong>$1</strong>");

  // Italic: *text* or _text_
  html = html.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_\n]+)_/g, "<em>$1</em>");

  return html;
}

export function markdownToSafeHtml(value = "", options = {}) {
  const { preserveLineBreaks = true } = options;
  const escaped = escapeHtml(value);
  const formatted = applyInlineFormatting(escaped);

  if (!preserveLineBreaks) return formatted;
  return formatted.replace(/\n/g, "<br />");
}

export function toPlainText(value = "") {
  return String(value)
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1");
}
