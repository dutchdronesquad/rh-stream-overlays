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

2. You'll be prompted to choose between **stable** or **development**:
    - **stable**: Choose this option if you want to install a stable release.
        - The script will fetch the last 5 stable releases from GitHub.
        - Choose the version you want to install and press enter.
    - **development**: Choose this option if you want to install the latest development version.
        - The script will fetch the main branch from GitHub.
5. If the plugin is already in RotorHazard, you'll be prompted to update it.
    - Choose **y (yes)** to update the plugin.
    - Choose **n (no)** to exit the script.
6. When the installation is finished, restart RotorHazard.

!!! note
    This script automates the installation or update of the "Stream Overlays" plugin for RotorHazard. It fetches the last 5 stable release or development branch from GitHub based on user choice, handles downloads, extracts files, and ensures cleanup of temporary data, simplifying the plugin installation process.

## Stream displays

!!! warning
    Currently this only works with the dev branch of RotorHazard, it will be available in the next stable release (v4.2.x).

After installing the plugin, you can find the overlays on the **Stream Displays** page in RotorHazard. The plugin will automatically create panels for each overlay, so you can easily find the URLs.

![alt stream displays](../assets/img/stream_overlays-page.png){ style="border-radius: 5px;" }