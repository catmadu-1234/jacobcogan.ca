export default { fetch: () => new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } }) };
