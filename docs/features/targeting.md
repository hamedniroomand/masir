# Route by device or country

> Send one short link to a destination that fits the visitor.

Targeting changes the destination after access rules pass. It does not change
the public short URL.

## Add rules

A link can contain:

- one destination for iOS
- one destination for Android
- one destination for desktop operating systems
- destinations for selected two-letter country codes

Every rule must use HTTP or HTTPS. Empty rules are removed when you save.

## Resolution order

Masir chooses the destination in this order:

1. country rule
2. operating-system rule
3. default link destination

A country rule wins when both a country and device rule match.

Bots use the default destination. This keeps link previews predictable.

## Provide the country

Masir does not guess a country from the client address. Set
`NUXT_GEO_COUNTRY_HEADER` to the trusted header that your CDN or reverse
proxy provides.

Examples include `CF-IPCountry` and `x-vercel-ip-country`.

Leave the setting empty when no trusted service adds the header. Country rules
will not match. Device rules still work.

::: warning Trust the header source
Remove an incoming header before your proxy writes its own value. A client
must not be able to choose its own country.
:::

## Test a rule

Use a browser or proxy that sends the same headers as production. Confirm the
`Location` response:

```sh
curl -I https://go.example.com/download \
  -H 'CF-IPCountry: DE' \
  -H 'User-Agent: Mozilla/5.0'
```

<ReadMore to="/features/analytics" title="See which routes visitors used" />

