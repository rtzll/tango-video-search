# Tango Video Search

**Problem:** YouTube search for tango performances is inefficient. Results are buried due to YouTube's algorithmic sorting and inconsistent metadata.

**Solution:** Tango Video Search provides a streamlined interface to filter by dancer or orchestra with minimal friction.

**How it works:** It’s powered by an LLM-curated index built from YouTube metadata. That means faster, more accurate retrieval of the performances you're looking for.

## Features

- Filter videos by dancer combinations
- Filter videos by orchestras
- Responsive video grid layout
- Quick filtering through video cards
- Video metadata display

## Tech Stack

- **Framework**: [React Router](https://reactrouter.com/) v8 (started as a Remix project)
- **UI**: [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Runtime**: [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- **Tooling**: [Vite+](https://viteplus.dev/) through the `vp` CLI

## Development

Requires Node.js 24 and the Vite+ `vp` CLI.

Install dependencies:

```sh
vp install --frozen-lockfile
```

Load the latest local SQLite snapshot into local D1:

```sh
vp run db:update --local --reset
```

Run the React Router development server:

```sh
vp run dev
```

Run the built Worker locally through Wrangler:

```sh
vp run preview
```

### Database

> [!NOTE]
> The database is not included in the repository.

The application reads from a D1 binding named `DB`. Local data updates are generated from the newest `data/sqlite-YYYY-MM-DD.db` snapshot. The schema includes:

- Videos (YouTube metadata)
- Performances (tango-specific metadata)
- Dancers, Orchestras, Songs, Singers, and Curations

Useful commands:

```sh
vp run db:update --sql-only
vp run db:update --local --reset
vp run db:update --remote
```

## Deployment

Cloudflare deployment is handled by Cloudflare Workers Builds after the GitHub repository is connected in Cloudflare:

- Pushes to `main` deploy production.
- Non-production branch builds upload Cloudflare preview versions.
- GitHub Actions runs repository checks on PRs and pushes to `main`.

```sh
vp run check
vp run deploy
```
