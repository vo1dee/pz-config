#!/usr/bin/env bash
# Restarts the Zomboid-Web sync backend (systemd service: zomboid-sync).
# Needed after any change to server/.env, since dotenv only loads it at startup.
set -euo pipefail

systemctl restart zomboid-sync.service
systemctl status zomboid-sync.service --no-pager
