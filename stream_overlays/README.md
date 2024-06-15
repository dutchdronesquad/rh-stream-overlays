# Showcase

Here you will find an overview of all available overlays. The plugin will automatically create panels for each overlay on the stream page in RotorHazard, so you can easily find the urls to use.

Links to the overlays:

- [Dutch Drone Squad](#overlay---dutch-drone-squad)
- [Liga Colombiana Drone Racing](#overlay---liga-colombiana-drone-racing)

> [!TIP]
> The plugin also generates overlay URLs on the **Stream displays** page in Rotorhazard, making it even easier to get started with the overlays.

## Overlay - Dutch Drone Squad

This overlay is designed by the [Dutch Drone Squad](https://dutchdronesquad.nl) and consists of a top bar, node overlay and leaderboards for class and overall.

### Topbar

The title in the top bar consists of a heat name and event name which dynamically adapts to what is set in RotorHazard.

URL to use: `RH-IP:5000/stream/overlay/dds/topbar`

![alt Screenshot of topbar](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/topbar-dds.png)

### Node

The node overlay shows the pilot name, lap time, total time and lap number. The color of the node changes based on what is set in RotorHazard for each pilot. Replace `[NUMBER]` with the node id you want to show.

URL to use: `RH-IP:5000/stream/overlay/dds/node/[NUMBER]`

[![Watch the video](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/node-dds.png)](https://www.youtube.com/watch?v=ZpV0veJErvE)
_Click on the image to watch a video of the overlay in action_

### Leaderboard - Class Ranking

The leaderboard class overlay displays the rankings of pilots within a specific class, including some race data. Pilots are presented in groups of eight, with a new set of pilots shown every 10 seconds.

The table adapts to the type of race format: **standard**, **fastest lap** or (top 3) **consecutive**. Replace `[CLASS ID]` with the class id you want to show or use `0` for the current class.

> [!IMPORTANT]
> Currently you only see data if you use **Ranking: From Race Format**

URL to use: `RH-IP:5000/stream/overlay/dds/leaderboard/[CLASS ID]/class`

[![Watch the video](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/ranking_class-dds.png)](https://youtu.be/xqIuBfLjtJE)
_Click on the image to watch a video of the overlay in action_

### Leaderboard - Overall Ranking

The leaderboard overall overlay displays the overall rankings of up to 32 pilots. Replace `[CLASS ID]` with the class id you want to show or use `0` for the current class.

> [!IMPORTANT]
> Currently you only see data if you use **Ranking: From Race Format**

URL to use: `RH-IP:5000/stream/overlay/dds/leaderboard/[CLASS ID]/overall`

[![Watch the video](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/ranking_overall-dds.png)](https://youtu.be/kTtoHACqsg0)
_Click on the image to watch a video of the overlay in action_

## Overlay - Liga Colombiana Drone Racing

This overlay is designed by the [Liga Colombiana Drone Racing](https://ligacolombianadroneracing.com) and consists of a top bar and a node overlay.

### Topbar

The title in the top bar consists of a heat name that changes dynamically and the organization name of LCDR (static).

![alt Screenshot of topbar](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/topbar-lcdr.png)

URL to use: `RH-IP:5000/stream/overlay/lcdr/topbar`

### Node

The node overlay shows the pilot name, lap time, total time and lap number. The color of the node changes based on what is set in RotorHazard for each pilot. Replace `[NUMBER]` with the node id you want to show.

URL to use: `RH-IP:5000/stream/overlay/lcdr/node/[NUMBER]`

[![Watch the video](https://raw.githubusercontent.com/dutchdronesquad/rh-stream-overlays/main/assets/overlays/node-lcdr.png)](https://www.youtube.com/watch?v=i46IejMjN_Q)
_Click on the image to watch a video of the overlay in action_
