# Verify ByTheSea
Mamallapuram | Coastal Serenity - story-driven coastal map experience.
## Launch
`npm start` (npx serve public on port 3000).
## Doctor
`python3 .cursor/skills/verify-by-the-sea/verify.py`
## Drive
Serves `public/` on port 3000 (the port the spec targets), then runs the repo's playwright mission check: system init, map visibility, marker render, keyboard activation and focus management, in real Chromium.
## Evidence
`.cursor/skills/verify-by-the-sea/evidence.json`
## Cleanup
The static server is process-group-killed after the run.
## Known boundaries
Remote map tiles are live-network dependent; the spec asserts app behavior, not tile content.
