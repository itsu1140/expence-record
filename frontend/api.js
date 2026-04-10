// ─── API ──────────────────────────────────────────────────────────────────────
const api = {
    async get(path) {
        const r = await fetch(path);
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async post(path, body) {
        const r = await fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async put(path, body) {
        const r = await fetch(path, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!r.ok) throw new Error(await r.text());
        if (r.status === 204) return null;
        return r.json();
    },
    async patch(path) {
        const r = await fetch(path, { method: "PATCH" });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async del(path) {
        const r = await fetch(path, { method: "DELETE" });
        if (!r.ok && r.status !== 204) throw new Error(await r.text());
    },
};
