# Targeting

One short link, a different destination for a device or a country. Put a QR
code on a poster and send iPhones to the App Store and Android phones to Play.

## Rules

Open a link, go to the **Settings** tab, and fill the **Targeting** card.

- **iOS**, **Android**, and **Desktop** each take a URL. Leave one empty and
  that device gets the main destination.
- **Countries** take a two-letter code and a URL. A link holds at most 20
  country rules.

Every rule URL follows the same checks as the main destination: `http` or
`https`, no private address, and never the short link itself.

## Which rule wins

Masir reads the rules in this order:

1. A country rule that matches the visitor's country.
2. A device rule that matches the visitor's operating system.
3. The main destination.

A country rule wins over a device rule, because a country rule is the rarer and
more deliberate one.

Query passthrough and the utm values apply to the destination that wins, not to
the main one. A visitor never sees which rule matched.

Bots follow the same rules, so a social preview shows the page that visitor
would reach.

## Countries need the proxy header

The country comes from the same header analytics read, `CF-IPCountry` by
default. Set `NUXT_GEO_COUNTRY_HEADER` when your proxy sends another name.

**Without that header no country rule ever matches**, and every visitor falls
through to the device rule or the main destination. Device rules work
everywhere, because they read the user agent.

See [Countries](/features/analytics#countries).
