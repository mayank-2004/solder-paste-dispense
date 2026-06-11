#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Solder Paste Dispenser — Raspberry Pi Vision Server Setup
# Run once on the Pi:  bash install-pi.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="solder-vision"
SERVICE_FILE="$SCRIPT_DIR/$SERVICE_NAME.service"

echo "=== [1/5] Installing system dependencies ==="
sudo apt-get update -q
# libgl1 + libglib2.0-0 are required by opencv-python-headless on Raspberry Pi OS
sudo apt-get install -y -q python3 python3-venv python3-pip libgl1 libglib2.0-0

echo "=== [2/5] Creating Python virtual environment ==="
python3 -m venv "$SCRIPT_DIR/venv"

echo "=== [3/5] Installing Python packages ==="
# Use headless OpenCV — no X11/GUI dependency needed on a headless Pi
"$SCRIPT_DIR/venv/bin/pip" install --upgrade pip -q
"$SCRIPT_DIR/venv/bin/pip" install \
    "fastapi==0.115.12" \
    "uvicorn[standard]==0.34.2" \
    "opencv-python-headless==4.11.0.86" \
    "numpy==2.2.5" \
    -q

echo "=== [4/5] Installing systemd service ==="
# Patch the WorkingDirectory and ExecStart paths to match the actual install location
sed \
    -e "s|WorkingDirectory=.*|WorkingDirectory=$SCRIPT_DIR|" \
    -e "s|ExecStart=.*|ExecStart=$SCRIPT_DIR/venv/bin/python server.py|" \
    -e "s|User=pi|User=$(whoami)|" \
    "$SERVICE_FILE" | sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl start  "$SERVICE_NAME"

echo "=== [5/5] Done ==="
echo ""
echo "Service status:"
sudo systemctl status "$SERVICE_NAME" --no-pager -l

echo ""
echo "Vision server is running at http://$(hostname -I | awk '{print $1}'):8000"
echo "Enter that URL in the app's Python Mode URL field."
echo ""
echo "Useful commands:"
echo "  sudo systemctl status $SERVICE_NAME   # check status"
echo "  sudo journalctl -u $SERVICE_NAME -f   # live logs"
echo "  sudo systemctl restart $SERVICE_NAME  # restart"
