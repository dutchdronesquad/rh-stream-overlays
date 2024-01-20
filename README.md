<!-- Header -->
![alt Header of the Stream Overlays RH plugin](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/header_rh_stream_overlays-min.png)

<!-- PROJECT SHIELDS -->
![Project Stage][project-stage-shield]
![Project Maintenance][maintenance-shield]
[![License][license-shield]](LICENSE)

## About

This plugin adds new designed stream overlays to RotorHazard, which can be used in OBS (Open Broadcaster Software). A showcase of all overlays can be [found here](./stream_overlays/).

Do you have any wishes for a new overlay? Then leave your ideas, sketches or mood board in the [discussions tab](https://github.com/dutchdronesquad/rh-stream-overlays/discussions) and maybe, we can develop it into something beautiful 😍

### Installation

#### RotorHazard

1. Install the Stream Overlays RH Plugin like any other plugin ([RH Plugin Documentation][rh-plugin-docs])

```bash
sh -c "$(curl -fsSL https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/tools/install.sh)"
```

2. Restart RotorHazard

#### OBS (Open Broadcaster Software)

1. Add a new source to your scene, with the `+` button
2. Select `Browser` as source type
3. Enter the URL of the overlay you want to use (see the [showcase](./stream_overlays/) for the URL's)
4. Set the width and height to the resolution of your stream (e.g. 1280 x 720)
5. Click `OK` to add the overlay to your scene

### Development

To get started, you obviously need a working [development environment][rh-dev] from RotorHazard.

1. Fork / Clone the repository
2. Create a symlink to the stream_overlays folder in the RotorHazard plugin folder

```bash
ln -s ~/rh-stream-overlays/stream_overlays/ ~/RotorHazard/src/server/plugins/stream_overlays
```

3. Start or restart RotorHazard
4. Start developing 😄

## License

Distributed under the **MIT** License. See [`LICENSE`](LICENSE) for more information.

<!-- LINKS -->
[rh-plugin-docs]: https://github.com/RotorHazard/RotorHazard/blob/main/doc/Plugins.md#installing-and-running
[rh-dev]: https://github.com/RotorHazard/RotorHazard/blob/main/doc/Development.md

[license-shield]: https://img.shields.io/github/license/dutchdronesquad/rh-stream-overlays.svg
[maintenance-shield]: https://img.shields.io/maintenance/yes/2024.svg
[project-stage-shield]: https://img.shields.io/badge/project%20stage-experimental-yellow.svg
