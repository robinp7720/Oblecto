#!/usr/bin/env bash

if [ ! -d "/etc/oblecto" ]; then
  sudo mkdir /etc/oblecto
  sudo chown $(whoami) /etc/oblecto

  dist/bin/oblecto.js init
  dist/bin/oblecto.js init database
fi

node tests/startup.js
node tests/startupTui.js
