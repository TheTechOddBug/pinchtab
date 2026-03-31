# Cache

Clear the browser's HTTP disk cache.

## Clear Cache

```bash
curl -X POST http://localhost:9867/cache/clear
# CLI Alternative
pinchtab cache clear
# Response
{
  "status": "cleared"
}
```

## Check Status

```bash
curl http://localhost:9867/cache/status
# CLI Alternative
pinchtab cache status
# Response
{
  "canClear": true
}
```

## Notes

- Clears the HTTP disk cache for all origins
- Does not affect cookies, localStorage, or sessionStorage
- Useful after app redeployments to ensure fresh JS/CSS bundles are fetched
- Can be called without an active tab

## Use Cases

**After app redeployments:** When a Vite/webpack app is rebuilt with new JS bundle hashes, stale cached bundles can cause issues. Clear the cache to ensure fresh resources are fetched:

```bash
pinchtab cache clear
pinchtab nav http://localhost:3000
```

**Debugging cache issues:** If you suspect cached resources are causing problems:

```bash
pinchtab cache clear
pinchtab reload
```

## Related Pages

- [Navigate](./navigate.md)
- [Profiles](./profiles.md)
