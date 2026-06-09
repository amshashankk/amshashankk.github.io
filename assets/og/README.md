# OG social cards

These are the 1200×630 images that preview when a page is shared on
LinkedIn, Slack, iMessage, X, etc. They are referenced by the
`<meta property="og:image">` / `<meta name="twitter:image">` tags in each page.

## Files
- `default.png` — home page + any generic page
- `<case-study-slug>.png` — one per case study (e.g. `upi-checkout.png`)
- `card.html` — the generator template (matches the live site's type & colours)

## Regenerating a card
Open `card.html` with query params, or use Chrome headless to export a PNG:

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1200,630 --virtual-time-budget=2500 \
  --screenshot="assets/og/upi-checkout.png" \
  "file://$PWD/assets/og/card.html?title=UPI-first%20checkout&metric=~3%C3%97%20conversion&tag=Conversion%20%C2%B7%20Payments"
```

Params: `title` (headline), `metric` (one big proof stat), `tag` (eyebrow line).

> Note: the OG URLs use the apex domain `https://shashankkesarwani.com`.
> The repo's `CNAME` is `www.shashankkesarwani.com` — make sure one 301-redirects
> to the other so the canonical host and the OG host match.
