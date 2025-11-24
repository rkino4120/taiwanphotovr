Place Noto Sans JP TTF here so the app can load it at runtime.

1. Download Noto Sans JP (Regular) from Google Fonts or https://fonts.google.com/specimen/Noto+Sans+JP
2. Save the TTF as: public/fonts/NotoSansJP-Regular.ttf

The code in `src/App.tsx` uses the path `/fonts/NotoSansJP-Regular.ttf` for the Text components.

If you deploy to Netlify (or other hosting), ensure the `public/fonts` folder is included in the build output so the font is served from `/fonts/NotoSansJP-Regular.ttf`.
