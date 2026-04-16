// ─── API ──────────────────────────────────────────────────────────────────────
const ROOT_PATH = window.ROOT_PATH || "";

const api = {
    async get(path) {
        const r = await fetch(ROOT_PATH + path);
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async post(path, body) {
        const r = await fetch(ROOT_PATH + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async put(path, body) {
        const r = await fetch(ROOT_PATH + path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        if (r.status === 204) return null;
        return r.json();
    },
    async patch(path) {
        const r = await fetch(ROOT_PATH + path, { method: "PATCH" });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async del(path) {
        const r = await fetch(ROOT_PATH + path, { method: "DELETE" });
        if (!r.ok && r.status !== 204) throw new Error(await r.text());
    },
};
