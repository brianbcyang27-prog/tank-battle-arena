// ==================== LOGGING SYSTEM ====================
export function log(type, event, data) {
  const ts = new Date().toLocaleTimeString();
  const msg = `[${ts}] [${event}] ${data||''}`;
  console.log(msg);
  const panel = document.getElementById('logPanel');
  if (panel) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = '[' + ts + ']';
    const eventSpan = document.createElement('span');
    eventSpan.className = 'log-' + type;
    eventSpan.textContent = '[' + event + ']';
    entry.appendChild(timeSpan);
    entry.appendChild(document.createTextNode(' '));
    entry.appendChild(eventSpan);
    entry.appendChild(document.createTextNode(' ' + (data||'')));
    panel.insertBefore(entry, panel.firstChild);
    if (panel.children.length > 100) panel.removeChild(panel.lastChild);
  }
}
window.log = log;
