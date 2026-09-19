#!/usr/bin/env bash
# Download the Jellyfin OpenAPI spec that the emulation layer is compared against.
# It is 2 MB and changes with every Jellyfin release, so it is fetched rather than committed.
set -euo pipefail

cd "$(dirname "$0")/.."
curl -fsSL https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json -o jellyfin-openapi-stable.json
echo "Saved jellyfin-openapi-stable.json"
