<!-- Header -->
![alt Header of the Stream Overlays RH plugin](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/header_rh_stream_overlays-min.png)

<!-- PROJECT SHIELDS -->
![Project Stage][project-stage-shield]
![Project Maintenance][maintenance-shield]
[![License][license-shield]](LICENSE)

![RHCP Badge][rhcp-shield]
[![RHFest][rhfest-shield]][rhfest-url]

## About

This plugin adds new designed stream overlays to RotorHazard, which can be used in [OBS](https://obsproject.com) (Open Broadcaster Software). A showcase of all overlays can be [found here](https://overlays.dutchdronesquad.nl/overlays).

Do you have any wishes for a new overlay? Then leave your ideas, sketches or mood board in the [discussions tab](https://github.com/dutchdronesquad/rh-stream-overlays/discussions) and maybe, we can develop it into something beautiful 😍

## Documentation

> [!IMPORTANT]
> Please note, the default branch shows development code and may be ahead of the released version. For the latest stable version, switch to the [release branch][release-branch] or use the installation instructions on the [website].

The full documentation can be found at [overlays.dutchdronesquad.nl][website]. Where you can find all the information about the overlays, how to install them and how to use them in [OBS](https://obsproject.com).

## Setting up development environment

This Python project relies on [UV] as its dependency manager,
providing comprehensive management and control over project dependencies.

You need the following tools to get started:

- [UV] - A python virtual environment/package manager
- [Python] 3.11 (or higher) - The programming language

### Installation

1. Clone the repository
2. Install all dependencies with UV. This will create a virtual environment and install all dependencies

```bash
uv sync --all-groups
```

### Prek check

As this repository uses the [prek][prek] framework, all changes
are linted and tested with each commit.

To install the prek check, run:

```bash
uv run prek install
```

To run all checks and tests manually, use the following command:

```bash
uv run prek run --all-files
```

To manual run only on the staged files, use the following command:

```bash
uv run prek run
```

## License

Distributed under the **MIT** License. See [`LICENSE`](LICENSE) for more information.

<!-- LINKS -->
[license-shield]: https://img.shields.io/github/license/dutchdronesquad/rh-stream-overlays.svg
[maintenance-shield]: https://img.shields.io/maintenance/yes/2026.svg
[project-stage-shield]: https://img.shields.io/badge/project%20stage-experimental-yellow.svg
[rhfest-shield]: https://github.com/dutchdronesquad/rh-stream-overlays/actions/workflows/rhfest.yaml/badge.svg
[rhfest-url]: https://github.com/dutchdronesquad/rh-stream-overlays/actions/workflows/rhfest.yaml
[rhcp-shield]: https://img.shields.io/badge/RotorHazard-Community_Plugins-orange.svg

[release-branch]: https://github.com/dutchdronesquad/rh-stream-overlays/branches/all?query=release
[website]: https://overlays.dutchdronesquad.nl

[UV]: https://docs.astral.sh/uv/
[Python]: https://www.python.org/
[prek]: https://github.com/j178/prek
