# Tango Video Search

A web application for searching and discovering Argentine tango dance videos based on dancers, orchestras, and more.

## Overview

Tango Video Search allows users to find tango dance videos by filtering through combinations of:
- Dancers (pairs or individuals)
- Orchestras
- Songs (coming soon)
- Singers (coming soon)

The application provides an intuitive interface to discover tango performances with a responsive grid layout of video cards.

## Tech Stack

- **Framework**: [React Router](https://reactrouter.com/) v7
- **UI**: [Radix UI](https://www.radix-ui.com/) + [Tailwind CSS](https://tailwindcss.com/)
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team/)
- **Deployment**: [Fly.io](https://fly.io)

## Development

To run the development server:

```sh
npm run dev
```

### Database

The application uses SQLite with a database file located at `data/sqlite.db`. The schema includes:
- Videos (YouTube metadata)
- Performances (tango-specific metadata)
- Dancers, Orchestras, Songs, and Singers
- Curations (verified performance metadata)

## Deployment

First, build the application for production:

```sh
npm run build
```

Then run in production mode:

```sh
npm start
```

### Deploying to Fly.io

The application is configured for deployment on Fly.io.

### Updating Data on Production

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

## Features

- Filter videos by dancer combinations
- Filter videos by orchestras
- Responsive video grid layout
- Quick filtering through video cards
- Video metadata display

## Future Enhancements

- Add pagination for video results
- Enable filtering by songs and singers
