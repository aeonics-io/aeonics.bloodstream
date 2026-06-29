# OAuth UI Theming Guide

The OAuth UI supports CSS custom properties for easy theming. The default theme is Bloodstream's dark theme, but projects can override it with their own branding.

## Available Theme Variables

| Variable | Default (Bloodstream) | Description |
|----------|----------------------|-------------|
| `--oauth-bg` | `#1C1B21` | Page background (can be color or `url()`) |
| `--oauth-panel-bg` | `#ffffff` | Login/consent/error panel background |
| `--oauth-text` | `#000000` | Primary text color in panels |
| `--oauth-text-secondary` | `#888888` | Secondary text (hints, onbehalf) |
| `--oauth-accent` | `#FB9B60` | Accent color for highlights |
| `--oauth-accent-hover` | `#FFA76F` | Hover state for interactive elements |
| `--oauth-timer` | `#FB9B60` | Code validity timer color |
| `--oauth-error` | `#f00` | Error message color |
| `--oauth-success` | `#147A00` | Success/agree button color |
| `--oauth-danger` | `#9C0000` | Danger/disagree button color |
| `--oauth-icon-bg` | `#dddddd` | Avatar/icon background color |
| `--oauth-border-radius` | `0px` | Panel border radius |
| `--oauth-panel-shadow` | `rgba(0, 0, 0, 0.2) 0px 2px 6px` | Panel drop shadow |
| `--oauth-font-family` | `inherit` | Custom font family |

## How to Override

### In HTML (before loading the app)

```html
<!DOCTYPE html>
<html>
<head>
    <title>OAuth</title>

    <!-- Override theme variables -->
    <style>
        :root {
            --oauth-bg: url('images/background.jpg');
            --oauth-panel-bg: #ffffff;
            --oauth-text: #333333;
            --oauth-accent: #d75d7f;
            --oauth-accent-hover: #e76d8f;
            --oauth-border-radius: 8px;
        }
    </style>

    <!-- Load OAuth UI CSS -->
    <link rel="stylesheet" href="/bloodstream/oauth/ui/css/theme.css">
    <link rel="stylesheet" href="/bloodstream/oauth/ui/css/page.l.css">
    <!-- ... other CSS files -->
</head>
<body>
    <!-- ... -->
</body>
</html>
```

### In a Separate CSS File

```css
/* custom-theme.css */
:root {
    /* Light theme with pink accent (Manager/Instance style) */
    --oauth-bg: url('../images/background.webp');
    --oauth-panel-bg: #ffffff;
    --oauth-text: #333333;
    --oauth-text-secondary: #999999;
    --oauth-accent: #d75d7f;
    --oauth-accent-hover: #e76d8f;
    --oauth-timer: #d75d7f;
    --oauth-border-radius: 4px;
    --oauth-font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
```

Then load it AFTER `theme.css`:

```html
<link rel="stylesheet" href="/bloodstream/oauth/ui/css/theme.css">
<link rel="stylesheet" href="custom-theme.css">
```

## Example Themes

### Bloodstream Dark (Default)
Already applied by default. Dark background with orange accents.

### Manager/Instance Light Theme
```css
:root {
    --oauth-bg: url('../images/background.webp');
    --oauth-panel-bg: #ffffff;
    --oauth-text: #333333;
    --oauth-accent: #d75d7f;
    --oauth-accent-hover: #e76d8f;
    --oauth-timer: #d75d7f;
}
```

### Corporate Blue Theme
```css
:root {
    --oauth-bg: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --oauth-panel-bg: #ffffff;
    --oauth-text: #2d3748;
    --oauth-text-secondary: #718096;
    --oauth-accent: #4299e1;
    --oauth-accent-hover: #63b3ed;
    --oauth-timer: #4299e1;
    --oauth-border-radius: 8px;
    --oauth-panel-shadow: rgba(0, 0, 0, 0.15) 0px 10px 40px;
}
```

### Minimalist Theme
```css
:root {
    --oauth-bg: #f7fafc;
    --oauth-panel-bg: #ffffff;
    --oauth-text: #1a202c;
    --oauth-text-secondary: #a0aec0;
    --oauth-accent: #000000;
    --oauth-accent-hover: #2d3748;
    --oauth-timer: #718096;
    --oauth-border-radius: 0px;
    --oauth-panel-shadow: rgba(0, 0, 0, 0.05) 0px 1px 3px;
}
```

## Notes

- Always include `theme.css` first to establish defaults
- Override only the variables you need to change
- Background images should be specified as `url('path/to/image.jpg')`
- The theme is applied using CSS custom properties, so changes are instant
- No JavaScript required for theming
