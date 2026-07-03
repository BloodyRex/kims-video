# Worker Intelligence Endpoints — Integration Guide

The file `workers-intelligence.js` contains all the handler functions.
Add these lines inside your existing Worker's `fetch()` handler
(before the final fallback return):

```js
// ── Intelligence API endpoints ──
if (method === "GET") {
  const intelMatch = path.match(/^/intelligence/(overview|movies|tv|trending|coming|weekly)$/);
  if (intelMatch) {
    const handlers = {
      overview: handleIntelligenceOverview,
      movies: handleIntelligenceMovies,
      tv: handleIntelligenceTV,
      trending: handleIntelligenceTrending,
      coming: handleIntelligenceComing,
      weekly: handleIntelligenceWeekly,
    };
    try {
      const data = await handlers[intelMatch[1]](env);
      return Response.json(data, { headers: corsHeaders });
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }
  }
}
```

Paste the entire content of `workers-intelligence.js` above your
`export default { ... }` block.

Note: `withCache` is already defined in your existing Worker.
If the module code references it, it will use the existing function.

Endpoints:
  GET /intelligence/overview  → overview.json format
  GET /intelligence/movies    → movies.json format
  GET /intelligence/tv        → tv.json format
  GET /intelligence/trending  → trending.json format
  GET /intelligence/coming    → coming.json format
  GET /intelligence/weekly    → weekly.json format
