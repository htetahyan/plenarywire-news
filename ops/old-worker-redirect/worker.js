// Old name "newsdesk-24": permanent redirect to the renamed PlenaryWire worker. No cron, no bindings.
const TARGET = "https://plenarywire.htetahyan.workers.dev";
export default {
  fetch(request) {
    const u = new URL(request.url);
    return new Response(null, { status: 301, headers: { location: TARGET + u.pathname + u.search, "x-robots-tag": "noindex, nofollow", "cache-control": "public, max-age=3600" } });
  },
};
