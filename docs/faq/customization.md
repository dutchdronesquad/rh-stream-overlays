---
title: Customization FAQ
description: Common questions about customizing overlay appearance.
---

# Customization

Common questions about changing colors, fonts, and creating custom themes.

### Can I change colors or fonts?

Each theme has its own design system. To customize:

**Option A:** Fork the repository and modify theme CSS files

**Option B:** Request a custom theme in [GitHub Discussions](https://github.com/dutchdronesquad/rh-stream-overlays/discussions) with your palette or sponsor kit

### Can I hide specific overlay elements?

Not through settings. To hide elements, you would need to edit the theme's HTML/CSS files directly in your installation.

### How do I create a custom theme?

1. Fork the [GitHub repository](https://github.com/dutchdronesquad/rh-stream-overlays)
2. Copy an existing theme folder (e.g., `apex`)
3. Modify HTML/CSS files to match your design
4. Test locally with RotorHazard
5. Submit a pull request to share with the community

See the [Development Guide](../installation/development.md) for details.

### Can I use my team logo in overlays?

Yes, but requires custom development. You'll need to:

- Fork the repository
- Add your logo to the theme's assets
- Modify the HTML to display it
- Install your custom version

### Are there more themes coming?

Yes! Theme requests are welcome in [Discussions](https://github.com/dutchdronesquad/rh-stream-overlays/discussions). Share your palette or mockups and we'll consider it.

### Can I mix elements from different themes?

Not directly. Each theme is designed as a cohesive package. For custom combinations, you'll need to fork the repository and create your own theme.

### How do I match my stream branding?

The best approach:

1. Choose the theme closest to your style (Apex, DDS, or LCDR)
2. Fork the repository
3. Update colors in the theme's CSS to match your brand
4. Replace fonts if needed (update CSS font-family)
5. Test and deploy your custom version

### Can I change the overlay layout?

Yes, but requires HTML/CSS knowledge. The layout is defined in each theme's template files. Fork the repository to make structural changes.

### Do overlays support custom pilot colors?

Yes! Overlays automatically use the pilot colors configured in RotorHazard. No customization needed.

### Can I add sponsor logos to overlays?

Yes, but requires custom development:

1. Fork the repository
2. Add logo images to the theme's assets
3. Modify the HTML template to display logos
4. Adjust CSS for positioning and sizing
