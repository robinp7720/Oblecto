#!/usr/bin/env bash
set -euo pipefail

# Use temporary configuration and databases; never initialize the live library.
node --import tsx tests/startup.ts
node --import tsx tests/startupTui.ts
