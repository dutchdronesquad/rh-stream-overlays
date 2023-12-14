#!/bin/bash

wget https://codeload.github.com/dutchdronesquad/rh-stream-overlays/zip/main -O ~/temp.zip
unzip ~/temp.zip

# Move the plugin folder into RotorHazard and remove the rest
mv ~/rh-stream-overlays-main/stream_overlays ~/RotorHazard/src/server/plugins/stream_overlays
rm -R ~/rh-stream-overlays-main
rm ~/temp.zip