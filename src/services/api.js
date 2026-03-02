/* ===== API SERVICE ===== */

async function jfetch(url, options = {}) {
    const r = await fetch(url, options);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

export async function fetchChatAbortable(message, signal) {
    const r = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
        signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

const api = {
    elevatorStatus: () => jfetch('/api/elevator/status'),
    weather: () => jfetch('/api/weather'),

    chat: (message) =>
        jfetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
        }),

    sos: (payload) =>
        jfetch('/api/sos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }),

    callFloor: (floor) =>
        jfetch('/api/elevator/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ floor }),
        }),
};

export default api;
