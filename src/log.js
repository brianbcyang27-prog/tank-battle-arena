// ==================== LOGGING SYSTEM ====================
export function log(type, event, data) {
    const ts = new Date().toLocaleTimeString();
    const entry = `<div class="log-entry"><span class="log-time">[${ts}]</span> <span class="log-${type}">[${event}]</span> ${data||''}</div>`;
    const panel = document.getElementById('logPanel');
    panel.insertAdjacentHTML('afterbegin', entry);
    console.log(`[${ts}] [${event}] ${data||''}`);
    if (panel.children.length > 100) panel.removeChild(panel.lastChild);
}
window.log = log;
