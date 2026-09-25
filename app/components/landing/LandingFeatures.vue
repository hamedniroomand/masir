<script setup lang="ts">
const features = [
  {
    icon: 'i-lucide-arrow-left-right',
    title: 'Change where a link goes',
    text: 'Edit the destination and every copy you shared follows. Masir answers with a 302, so browsers never cache the old target. Rename a slug and keep the old one as an alias, or add up to 10 extra addresses.',
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Decide who opens it, and when',
    text: 'A password, a start date, an expiry, a visit cap, and a one-time link. Combine any of them. Each rule can send late or early visitors to a fallback page instead of a 404.',
  },
  {
    icon: 'i-lucide-crosshair',
    title: 'One link, several destinations',
    text: 'Send iPhones to the App Store, Android to Play, and desktops to the web page. Add up to 20 country rules. Put one QR code on the poster.',
  },
  {
    icon: 'i-lucide-qr-code',
    title: 'QR codes ready for print',
    text: 'Download an SVG or PNG for every link, in your colours, with the workspace logo in the middle. A printed code never changes hands, because a used slug never returns to the pool.',
  },
  {
    icon: 'i-lucide-megaphone',
    title: 'Tags and campaigns',
    text: 'Tags group links for the long run and filter the list. A campaign owns the utm_campaign and utm_medium values, and every link in it inherits them. Visitor query strings pass straight through.',
  },
  {
    icon: 'i-lucide-users',
    title: 'A workspace for the team',
    text: 'One owner, members who manage links, and viewers who only read. Sign in with email, Google, or Microsoft. A grouped activity log records who changed what.',
  },
  {
    icon: 'i-lucide-braces',
    title: 'An API for everything',
    text: 'Every action in the interface is a normal HTTP endpoint. A bookmarklet creates a link from any page you are on, with the title already filled in.',
  },
  {
    icon: 'i-lucide-history',
    title: 'A history you can trust',
    text: 'Every change to a link is recorded with the person and the fields that moved. Deleted links keep their slug and their click history.',
  },
];
</script>

<template>
  <LandingSection
    id="features"
    title="Built for links you will still be sharing next year."
    lead="A short link is a promise that the address keeps working. Everything here exists to keep that promise while the destination, the audience, and the team change."
  >
    <dl class="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="feature in features" :key="feature.title" class="flex flex-col gap-3">
        <UIcon :name="feature.icon" class="size-5 text-primary" />
        <dt class="text-base font-semibold tracking-tight text-highlighted">
          {{ feature.title }}
        </dt>
        <dd class="text-sm leading-6 text-muted">
          {{ feature.text }}
        </dd>
      </div>
    </dl>

    <div class="mt-16 grid gap-6 md:grid-cols-2">
      <div class="rounded-xl border border-default bg-muted/20 p-6">
        <div class="flex items-center gap-2 text-sm font-semibold text-primary">
          <UIcon name="i-lucide-flag" class="size-4" />
          <span>Campaign launch example</span>
        </div>
        <h3 class="mt-2 text-base font-semibold text-highlighted">
          Stable printed links with recorded attribution
        </h3>
        <p class="mt-2 text-sm leading-6 text-muted">
          Print <code>/launch</code> on physical posters. Point it to a teaser page before launch, switch to the live store on launch day, and send late visitors to a waitlist when stock runs out. Effective campaign attribution is recorded at click time, so later updates never alter historical reports.
        </p>
      </div>

      <div class="rounded-xl border border-default bg-muted/20 p-6">
        <div class="flex items-center gap-2 text-sm font-semibold text-primary">
          <UIcon name="i-lucide-folder-sync" class="size-4" />
          <span>Shared resource example</span>
        </div>
        <h3 class="mt-2 text-base font-semibold text-highlighted">
          Team ownership for shared assets
        </h3>
        <p class="mt-2 text-sm leading-6 text-muted">
          Share <code>/brand-kit</code> across your team handbook, email footers, and partner guides. When design moves files to a new drive or Figma link, any authorized team member can update the target URL immediately. Links belong to the workspace, not a personal account.
        </p>
      </div>
    </div>
  </LandingSection>
</template>
