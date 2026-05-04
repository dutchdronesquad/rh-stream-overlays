---
title: Leaderboards
description: DDS leaderboard overlay URLs and usage guidance.
---

# Leaderboards

Leaderboards show class or overall ranking data from RotorHazard. DDS currently provides the leaderboard layouts.

## URLs

Class leaderboard:

```bash
http://[RH-IP]:5000/stream/overlay/dds/leaderboard/[class-id]/class
```

Overall leaderboard:

```bash
http://[RH-IP]:5000/stream/overlay/dds/leaderboard/[class-id]/overall
```

Use `0` for the current class or replace `[class-id]` with a fixed RotorHazard class ID.

## Requirements

!!! warning
    Leaderboard overlays currently require **Ranking: From Race Format** in RotorHazard.

## Best uses

- Results scene after a race.
- Podium or awards scene.
- Side-by-side scene with a TrackDraw map.

## Display behavior

Class leaderboards paginate longer lists so the overlay can cover more pilots without crowding the scene. Overall leaderboards are intended for broader event standings.
