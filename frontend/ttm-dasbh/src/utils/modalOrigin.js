let lastModalClick = null;

export function setLastModalClick(event) {
  if (!event) return;
  const x = event.clientX;
  const y = event.clientY;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  lastModalClick = { x, y };
}

export function getLastModalClick() {
  return lastModalClick;
}
