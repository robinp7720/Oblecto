#!/bin/sh
# First run: write a config with a random secret, asset directories and federation keys into the
# /etc/oblecto volume. Later runs use what is there. Migrations run when the server starts.
set -eu

if [ "${1:-start}" = "start" ] || [ "${1:-}" = "start-tui" ]; then
    if [ ! -f "${OBLECTO_CONFIG_PATH:-/etc/oblecto/config.json}" ]; then
        echo "No configuration found, creating one in /etc/oblecto"
        node /opt/oblecto/dist/bin/oblecto.js init
        echo "Add your library folders in the web UI's settings, or in /etc/oblecto/config.json."
    fi
fi

exec node /opt/oblecto/dist/bin/oblecto.js "$@"
