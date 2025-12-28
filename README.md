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

After preparing a new database file:

1. Copy the `.db` file into `/data` and update the `sqlite.db` symlink:
   ```sh
   ln -s sqlite-2025-MM-DD.db sqlite.db
   ```

2. Connect to the Fly.io instance and remove the old database:
   ```sh
   fly ssh console
   rm /data/sqlite.db*
   ```

3. Upload the new database file:
   ```sh
   fly sftp shell
   put data/sqlite.db /data/sqlite.db
   ```

4. Restart the application:
   ```sh
   fly apps restart
   ```
