# Atlas Trail Tree Planner

A map-first travel planning website where a trip is represented as editable tree data. Each node stores:

- `id`
- `name`
- date range
- time range
- hotel/dining flags
- GPS, address, or area
- description
- level

The app stores nodes locally in IndexedDB, a browser NoSQL database, so edits survive refreshes without a backend server.

## Run locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.
