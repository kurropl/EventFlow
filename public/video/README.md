# Hero video

The landing hero (`src/app/page.tsx`) renders a `<video>` that automatically
plays a file placed here:

```
public/video/hero.mp4
```

Drop an impactful celebration-venue clip (1080p, H.264/AAC, muted, ~10–20s loop)
named exactly `hero.mp4` in this folder and redeploy. The video autoplays muted
and loops behind the headline.

Until a file is present, the hero falls back to a self-contained cinematic
backdrop (`/images/hero-poster.svg` with a slow Ken Burns zoom, light sweep and
ambient gold orbs), so the hero always looks finished — no broken state.

Recommended sources for royalty-free footage: Pexels, Coverr, Mixkit
(search "wedding venue", "banquet hall", "celebration table").
