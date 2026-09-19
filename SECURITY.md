# Security

## Reporting a problem

Please report security problems privately, through GitHub's "Report a vulnerability" on the repository's Security tab, rather than in a public issue. Include what you found, how to reproduce it and which version you run.

## What Oblecto protects

- Every API route that reads a user's data or changes anything needs a signed-in session, and settings, users, libraries and maintenance need the matching group permission.
- Web sign-ins expire after `authentication.tokenLifetimeDays`. Changing a password, or deleting an account, ends every session for it, in the web app and in Jellyfin apps.
- Failed sign-ins are throttled per address and account.
- Jellyfin apps only ever see the signed-in user's data, whatever user id they send.
- Other websites cannot call the APIs from a browser unless their origin is listed in `server.corsOrigins`.
- `config.json` and the federation private key are created readable by their owner only. The settings API never returns the signing secret, the federation key or seedbox passwords.
- Uploads are accepted only after the permission check, up to 25 MB, and re-encoded before they are stored.

## Public on purpose

- **Artwork** (posters, fanart, episode images) is served without signing in, because the web app and Jellyfin apps load it with plain image requests. It reveals which titles are in the library, nothing about users.
- **Avatars and public profiles** are shown on the sign-in page to devices on the local network when the profile picker is on (off by default). Profiles are only listed when a user opts in.
- **Password-less sign-in** on the local network is off by default. When you turn it on, anyone who can reach Oblecto from an address counted as local can sign in as the users who allowed it. Set `authentication.localSubnets` and `trustProxy` to match your network.

## Running it safely

- Keep `/etc/oblecto` readable only by the user Oblecto runs as; it holds the signing secret and API keys.
- Put Oblecto behind a reverse proxy with HTTPS before exposing it to the internet, and set `authentication.trustProxy` only then.
- The Jellyfin API listens on all interfaces by default. Set `jellyfin.host` to `127.0.0.1`, or `jellyfin.enabled` to `false`, if you do not use Jellyfin apps.
