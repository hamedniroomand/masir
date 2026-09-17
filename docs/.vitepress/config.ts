import { defineConfig } from 'vitepress';

import { icon } from './icons.ts';

const DESCRIPTION
  = 'Masir is a self-hosted link manager for teams. Short links your team owns, destinations you can change after sharing, and analytics that never store a visitor IP.';

// Sidebar links carry the icon the page used to declare in its frontmatter.
function link(name: string, text: string, path: string) {
  return { text: icon(name) + text, link: path };
}

export default defineConfig({
  title: 'Masir',
  description: DESCRIPTION,
  lang: 'en-US',

  base: '/masir/',

  cleanUrls: true,
  lastUpdated: true,

  // Working notes live beside the site and are not pages.
  srcExclude: ['plans/**', 'superpowers/**'],

  sitemap: { hostname: 'https://hamedniroomand.github.io/masir/' },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/masir/icon.svg' }],
    ['meta', { name: 'theme-color', content: '#2566f0' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Masir' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
  ],

  markdown: {
    theme: { light: 'github-light', dark: 'github-dark' },
    // A fence written as ```ts [file.ts] keeps its filename. VitePress parses
    // the label for code groups but shows the language elsewhere, so put the
    // label in the badge the block already renders.
    config(md) {
      const fence = md.renderer.rules.fence!;
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!;
        if (token.info.trim() === 'mermaid')
          return `<Mermaid code="${encodeURIComponent(token.content)}" />`;
        const title = token.info.match(/\[(.+?)\]/)?.[1];
        const html = fence(tokens, idx, options, env, self);
        return title
          ? html.replace(/<span class="lang">.*?<\/span>/, `<span class="lang">${title}</span>`)
          : html;
      };
    },
  },

  themeConfig: {
    siteTitle: 'Masir',

    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'Features', link: '/features/', activeMatch: '/features/' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
      { text: 'Project', link: '/project/', activeMatch: '/project/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Get started',
          items: [
            link('compass', 'Introduction', '/guide/'),
            link('package', 'Installation', '/guide/installation'),
            link('rocket', 'Your first link', '/guide/quickstart'),
          ],
        },
        {
          text: 'Teams',
          items: [
            link('building-2', 'Workspaces', '/guide/workspaces'),
            link('users', 'Members and roles', '/guide/members'),
            link('key-round', 'Signing in', '/guide/authentication'),
          ],
        },
        {
          text: 'Running it',
          items: [
            link('server', 'Self-hosting', '/guide/self-hosting'),
            link('cloud', 'Multi-workspace mode', '/guide/multi-workspace'),
            link('triangle', 'Vercel', '/guide/vercel'),
            link('life-buoy', 'Troubleshooting', '/guide/troubleshooting'),
          ],
        },
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            link('sparkles', 'Overview', '/features/'),
            link('link', 'Short links', '/features/links'),
            link('shield-check', 'Access control', '/features/access-control'),
            link('chart-line', 'Analytics', '/features/analytics'),
            link('megaphone', 'Tags and campaigns', '/features/campaigns'),
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            link('braces', 'Overview', '/reference/'),
            link('settings', 'Environment variables', '/reference/environment'),
            link('terminal', 'Scripts', '/reference/scripts'),
            link('database', 'Data model', '/reference/data-model'),
          ],
        },
      ],
      '/project/': [
        {
          text: 'Project',
          items: [
            link('folder-git-2', 'Overview', '/project/'),
            link('network', 'Architecture', '/project/architecture'),
            link('lock', 'Security', '/project/security'),
            link('hammer', 'Development', '/project/development'),
          ],
        },
      ],
    },

    outline: { level: [2, 3], label: 'On this page' },

    socialLinks: [{ icon: 'github', link: 'https://github.com/hamedniroomand/masir' }],

    editLink: {
      pattern: 'https://github.com/hamedniroomand/masir/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: { provider: 'local' },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026-present Hamed Niroomand',
    },
  },
});
