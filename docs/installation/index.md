---
title: Installation
description: Installation instructions for the Stream Overlays plugin for RotorHazard.
---

# Installation

Follow the steps below to install the Stream Overlays plugin for RotorHazard.

## RotorHazard

1. Install the **Stream Overlays** RotorHazard plugin, by running the following command in your terminal at the device where RotorHazard is installed:
``` bash
bash -c "$(curl -fsSL https://short.dutchdronesquad.nl/install-overlays-plugin)"
```

2. Choose for **stable** or **development** version and press enter.
3. When the installation is finished, restart RotorHazard.

!!! note
    This script automates the installation or update of the "Stream Overlays" plugin for RotorHazard. It fetches the latest stable release or development version from GitHub based on user choice, handles downloads, extracts files, and ensures cleanup of temporary data, simplifying the plugin installation process.

## Stream displays

!!! warning
    Currently this only works with the dev branch of RotorHazard, it will be available in the next stable release (v4.2.x).

After installing the plugin, you can find the overlays on the **Stream Displays** page in RotorHazard. The plugin will automatically create panels for each overlay, so you can easily find the URLs.

![alt stream displays](../assets/img/stream_overlays-page.png){ style="border-radius: 5px;" }