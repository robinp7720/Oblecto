# Upgrading

Oblecto has no migrations. When a release changes the schema, apply the statements below to an existing database before starting the new version. They are written for MariaDB/MySQL; SQLite users can run the same `ALTER TABLE ... ADD COLUMN` statements one column at a time.

## User groups and permissions

```sql
CREATE TABLE `Groups` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    permissions TEXT NOT NULL,
    builtIn TINYINT(1) NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL
);

ALTER TABLE `Users`
    ADD COLUMN groupId INT NULL,
    ADD CONSTRAINT fk_users_group FOREIGN KEY (groupId) REFERENCES `Groups`(id) ON DELETE SET NULL;
```

The server creates the **Administrators** and **Users** groups when it starts. Existing users start in no group, which grants no permissions, so nobody can open the server settings until you promote someone:

```sh
oblecto usergroup USERNAME Administrators
```

Put everyone else in **Users**, or in a group of your own, from the Users page under settings.

## Profile picker and avatars

```sql
ALTER TABLE `Users`
    ADD COLUMN publicProfile TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN passwordlessLocal TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN avatar VARCHAR(255) NULL;
```
