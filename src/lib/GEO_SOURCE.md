# geo.js — shared walk math

`geo.js` is copied **byte-for-byte** from the website (Base44 app
6a5ea09f92a56e347e3049b7, `src/lib/geo.js`), which is also what the
`log-walk-miles` backend function runs. Keeping one copy of the rules is
what makes "miles on the phone" = "miles on the website" = "miles credited".

| Copied | SHA-256 |
|---|---|
| 2026-11-22 | `8693ee1867f5dcf38992940d0b79cf00b6e5f898485e125edf7b8b8aaf610319` (gap bridging) |

Never edit `geo.js` here. When the website's copy changes, copy it again,
update the checksum above, and update `geo.d.ts` if an export changed.
Check with: `sha256sum src/lib/geo.js`
