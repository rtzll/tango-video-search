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

- **Framework**: [React Router](https://reactrouter.com/) v7 (started as a Remix project)
- **UI**: [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database**: [SQLite](https://sqlite.org/) with [Drizzle ORM](https://orm.drizzle.team/)
- **Runtime**: [Bun](https://bun.sh/)
- **Deployment**: [Fly.io](https://fly.io)

## Development

To run the development server:

```sh
bun run dev
```

### Database

> [!NOTE]
> The database is not included in the repository. 

The application uses SQLite via Drizzle ORM with a database file at `data/sqlite.db` by default, or override the path using the `DATABASE_URL` environment variable. The schema includes:
- Videos (YouTube metadata)
- Performances (tango-specific metadata)
- Dancers, Orchestras, Songs, Singers, and Curations

## Deployment

Deploying the application is handled by GitHub Actions, which will automatically deploy to Fly.io when you push to the `main` branch.

### Updating Data in Production

Use the automation script:

```sh
bun run db:update
```

What it does:
- Scans `data/` for files named `sqlite-YYYY-MM-DD.db` and picks the latest date
- Updates local `data/sqlite.db` symlink
- Uploads the latest file to Fly volume via `fly ssh sftp put`
- Repoints `/data/sqlite.db` on the VM to the uploaded file via `fly ssh console -C`
- Restarts the Fly app

Useful flags:

```sh
bun run db:update --dry-run
bun run db:update --force
bun run db:update --app tango-video-search
bun run db:update --no-restart
```
