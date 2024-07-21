---
title: Development
description: Development instructions for the Stream Overlays plugin for RotorHazard.
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

Make sure you have installed [Poetry](https://python-poetry.org/docs/#installation) to manage the dependencies of the project.

1. **Fork** and **Clone** the repository to your local machine
2. Run the following commands to install the dependencies
```bash
poetry install
```

3. Start the documentation server
```bash
poetry run mkdocs serve
```

4. Open the application in your browser
```
http://localhost:8000
```

<!-- LINKS -->
[rh-dev]: https://github.com/RotorHazard/RotorHazard/blob/main/doc/Development.md
[symlink]: https://linuxize.com/post/how-to-create-symbolic-links-in-linux-using-the-ln-command
[discussions]: https://github.com/dutchdronesquad/rh-stream-overlays/discussions