# Upgrading

Back up your database before upgrading. For SQLite that is a copy of the database file; for MariaDB or MySQL use `mysqldump`.

## Database changes happen on their own

Oblecto updates the database schema when it starts. Each change is a named migration, recorded in the `SchemaMigrations` table, so it runs once. Migrations only add tables and columns; they never drop data.

To see or apply pending migrations yourself:

```sh
oblecto migrate --status
oblecto migrate
```

To stop Oblecto from changing the schema by itself, set `database.migrateOnStart` to `false`. It then refuses to start until `oblecto migrate` has run.

Databases that were upgraded by hand with the SQL this page used to list are fine: each migration checks for the columns it adds and records itself without changing anything.

## After upgrading to 1.0

### Everyone signs in again

Sign-in tokens now expire, after `authentication.tokenLifetimeDays` (30 by default), and stop working when the password changes. Tokens from earlier versions are not accepted, so every browser and app signs in once more.

Jellyfin apps sign in again as well. Their tokens now survive restarts, which earlier versions did not.

### Promote an administrator

The first start creates the **Administrators** and **Users** groups. Users who existed before start in no group, which grants no permissions, so nobody can open the server settings until you promote someone:

```sh
oblecto usergroup USERNAME Administrators
```

Put everyone else in **Users**, or in a group of your own, from the Users page under settings.

### Check your configuration

- Oblecto reads `OBLECTO_CONFIG_PATH`, or `/etc/oblecto/config.json`. It no longer reads `res/config.json` from the working directory.
- It refuses to start without `authentication.secret`, or with the old placeholder `secret`. `oblecto init` writes a random one.
- Settings missing from your file take their defaults from `res/config.json`. Two defaults changed: `authentication.allowPasswordlessLogin` and `authentication.profilePicker` are now off. Set them to `true` to keep the old behaviour.
- The Jellyfin API has its own section, `jellyfin`, with `enabled`, `port` (8096) and `host` (0.0.0.0).
