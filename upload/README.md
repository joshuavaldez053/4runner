# 4Runner — gas split tracker

A private home-screen app for an iPhone. It tracks who drives the truck, what they owe for gas, and what you spend yourself. Your data stays on your phone.

## Put it on your iPhone (free, ~10 min, one time)

1. Make a free account at github.com.
2. Click **+** → **New repository**. Name it `4runner`, make it **Public**, and create it.
3. Click **uploading an existing file** and drag in every file from this folder **except** `.claude`, `calc.test.js` and `package.json`. Then click **Commit changes**.
4. Open the repo's **Settings** → **Pages**. Under Branch, pick `main`, then `/ (root)`, then **Save**.
5. Wait about a minute. Your link is `https://YOUR-USERNAME.github.io/4runner/`.
6. On the iPhone, open that link in **Safari**. Tap **Share** → **Add to Home Screen** → **Add**.

Open it from the home-screen icon from now on. It runs full screen and works offline.

## Daily use

| When | Do |
|---|---|
| Someone borrows it | **TRIP** → tap their face → type miles. Or pick **ODOMETER**, type the reading, and tap ✓ to check them out ("OUT" badge). When they're back: **TRIP** → their face → type the odometer → ✓ |
| You drive | Nothing. Any miles not logged to someone else count as yours. |
| At the pump | **FUEL** → odometer, gallons, $ from the receipt. Turn off **Full tank** if you didn't fill all the way → ✓ |
| Get paid | Tap their face → **REQUEST** → **TEXT**. Messages opens with the amount; they tap Apple Cash and send it. **SHARE** works for Zelle or anything else. |
| They paid | Tap their face → **PAID** → ✓ |

- **Your first fill-up** sets the starting odometer. Do one right away so your own miles get counted from then on.
- **MPG** starts at 14 (a guess for a supercharged '99 4Runner). After two full-tank fill-ups the app learns your real MPG.
- **Price per gallon** comes from your last receipt. Until then it uses $4.19, a rough Tucson premium price. TRD recommends 91 octane for the supercharger. You can change this in Settings.
- **Backup**: Settings → **EXPORT** now and then. If you ever lose your data, restore it with **IMPORT**.
- **Mistakes**: tap × to delete an unbilled trip or a payment. To undo the latest fill-up, tap the big $ number, then tap × next to that fill-up.

## Updating the app later
Change the files, bump `VERSION` in `sw.js`, and upload them to GitHub again. Your phone picks up the update the next time it's online.

## Dev
```
node --test           # math tests
python3 -m http.server 8417
```
