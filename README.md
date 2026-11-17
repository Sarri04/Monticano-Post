# Programmi Monticano (repo `Monticano-Post`)

PWA per iPhone che crea le grafiche Instagram del Monticano C5: annuncio partita, risultato, descrizione.
Gli **sfondi** li genera l'AI (FLUX.1 schnell su Cloudflare Workers AI, piano gratuito); **testi, punteggi e loghi** li compone l'app come livelli modificabili, così nomi, date e risultati non sono mai sbagliati e i loghi non si deformano.

- Documentazione completa: nel vault Obsidian, `Progetti/Generatore Grafiche Monticano/`.
- Sviluppo: `npm install`, `npm run dev`, `npm test`, `npm run build`.
- Pubblicazione: ogni push su `main` esegue test, build e deploy su GitHub Pages (`.github/workflows/deploy.yml`).
- Proxy AI: `worker/worker.js` (da incollare in un Cloudflare Worker, vedi guida nel vault).
