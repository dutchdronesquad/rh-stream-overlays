---
title: Development
description: Instructions to set up a development environment for the stream overlays plugin.
---

# Development environment

If you would like to contribute to the project, you need a working [development environment][rh-dev] from RotorHazard. After setting up the development environment, you can follow the steps below to start developing the stream overlays.

Are you not a coder? But would you like to share ideas for new features? Then join the [discussions] and we will work out some sketches together.

## Plugin code

1. **Fork** and **Clone** the repository to your local machine
2. Create a [symlink] from the `stream_overlays` folder to the RotorHazard `plugin` folder
```bash
ln -s ~/rh-stream-overlays/stream_overlays/ ~/RotorHazard/src/server/plugins/stream_overlays
```

3. Start or restart RotorHazard
4. You can now start developing 😄

## Documentation

The documentation is built with [Zensical](https://zensical.org/) and hosted on [GitHub Pages](https://pages.github.com/). The documentation is written in Markdown and can be found in the `docs` folder. Zensical supports the existing `mkdocs.yml` configuration file used by this project, so the current docs structure can stay in place during the migration. This Python project relies on [UV](https://docs.astral.sh/uv/) as its dependency manager, providing comprehensive management and control over project dependencies.

To make changes to the documentation, you need to set up a local development environment. This will allow you to preview your changes before pushing them to the repository.

1. **Fork** and **Clone** the repository to your local machine
2. Run the following commands to install the dependencies
```bash
uv sync --all-groups
```

3. Start the documentation server
```bash
uv run zensical serve
```

4. Open the application in your browser
```bash
http://localhost:8000
```

<!-- LINKS -->
[rh-dev]: https://github.com/RotorHazard/RotorHazard/blob/main/doc/Development.md
[symlink]: https://linuxize.com/post/how-to-create-symbolic-links-in-linux-using-the-ln-command
[discussions]: https://github.com/dutchdronesquad/rh-stream-overlays/discussions
