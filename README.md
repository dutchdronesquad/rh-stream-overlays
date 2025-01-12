<!-- Header -->
![alt Header of the Stream Overlays RH plugin](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/header_rh_stream_overlays-min.png)

<!-- PROJECT SHIELDS -->
![Project Stage][project-stage-shield]
![Project Maintenance][maintenance-shield]
[![License][license-shield]](LICENSE)

## About

This plugin adds new designed stream overlays to RotorHazard, which can be used in [OBS](https://obsproject.com) (Open Broadcaster Software). A showcase of all overlays can be [found here](https://overlays.dutchdronesquad.nl/overlays).

Do you have any wishes for a new overlay? Then leave your ideas, sketches or mood board in the [discussions tab](https://github.com/dutchdronesquad/rh-stream-overlays/discussions) and maybe, we can develop it into something beautiful 😍

## Documentation

> [!IMPORTANT]
> Please note, the default branch shows development code and may be ahead of the released version. For the latest stable version, switch to the [release branch][release-branch] or use the installation instructions on the [website].

The full documentation can be found at [overlays.dutchdronesquad.nl][website]. Where you can find all the information about the overlays, how to install them and how to use them in [OBS](https://obsproject.com).

## Setting up development environment

This Python project relies on [Poetry][poetry] as its dependency manager,
providing comprehensive management and control over project dependencies.

You need at least:

- Python 3.11+
- [Poetry][poetry-install]

### Installation

Install all packages, including all development requirements:

```bash
poetry install
```

_Poetry creates by default an virtual environment where it installs all necessary pip packages_.

### Pre-commit

This repository uses the [pre-commit][pre-commit] framework, all changes
are linted and tested with each commit. To setup the pre-commit check, run:

```bash
poetry run pre-commit install
```

And to run all checks and tests manually, use the following command:

```bash
poetry run pre-commit run --all-files
```

## License

Distributed under the **MIT** License. See [`LICENSE`](LICENSE) for more information.

<!-- LINKS -->
[license-shield]: https://img.shields.io/github/license/dutchdronesquad/rh-stream-overlays.svg
[maintenance-shield]: https://img.shields.io/maintenance/yes/2024.svg
[project-stage-shield]: https://img.shields.io/badge/project%20stage-experimental-yellow.svg

[release-branch]: https://github.com/dutchdronesquad/rh-stream-overlays/branches/all?query=release
[website]: https://overlays.dutchdronesquad.nl

[poetry-install]: https://python-poetry.org/docs/#installation
[poetry]: https://python-poetry.org
[pre-commit]: https://pre-commit.com
