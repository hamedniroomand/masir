import { defineConfig } from 'vitepress';

import { icon } from './icons.ts';

const DESCRIPTION
  = 'Masir is an open-source link management platform for teams. Run it on your infrastructure, publish links on your domain, and keep control after you share them.';

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
  srcExclude: ['plans/**', 'product/**', 'superpowers/**'],

  sitemap: { hostname: 'https://hamedniroomand.github.io/masir/' },

  head: [
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/masir/icon.svg' }],
    ['meta', { name: 'theme-color', content: '#2566f0' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Masir Documentation' }],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:image', content: 'https://hamedniroomand.github.io/masir/og-image.png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Masir Documentation' }],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: 'https://hamedniroomand.github.io/masir/og-image.png' }],
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
    logo: '/icon.svg',

    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Get started', link: '/guide/', activeMatch: '^/guide/(?:$|installation|quickstart)' },
      { text: 'User guide', link: '/features/', activeMatch: '^/(?:features|guide/(?:workspaces|members|authentication))' },
      { text: 'Self-hosting', link: '/guide/self-hosting', activeMatch: '^/guide/(?:self-hosting|multi-workspace|upgrading|vercel|troubleshooting)' },
      { text: 'Reference', link: '/reference/', activeMatch: '/reference/' },
      { text: 'Contributing', link: '/project/', activeMatch: '/project/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Start here',
          items: [
            link('compass', 'Choose your path', '/guide/'),
            link('package', 'Install Masir', '/guide/installation'),
            link('rocket', 'Create your first link', '/guide/quickstart'),
          ],
        },
        {
          text: 'Use Masir',
          items: [
            link('building-2', 'Workspaces', '/guide/workspaces'),
            link('users', 'Members and roles', '/guide/members'),
            link('key-round', 'Accounts and sign-in', '/guide/authentication'),
          ],
        },
        {
          text: 'Operate Masir',
          items: [
            link('server', 'Production setup', '/guide/self-hosting'),
            link('arrow-up-circle', 'Upgrading', '/guide/upgrading'),
            link('cloud', 'Multi-workspace deployments', '/guide/multi-workspace'),
            link('triangle', 'Deploy on Vercel', '/guide/vercel'),
            link('life-buoy', 'Troubleshooting', '/guide/troubleshooting'),
          ],
        },
      ],
      '/features/': [
        {
          text: 'User guide',
          items: [
            link('sparkles', 'Start here', '/features/'),
            link('link', 'Create and manage links', '/features/links'),
            link('shield-check', 'Control link access', '/features/access-control'),
            link('crosshair', 'Route by device or country', '/features/targeting'),
            link('chart-line', 'Measure link traffic', '/features/analytics'),
            link('megaphone', 'Organize links', '/features/campaigns'),
          ],
        },
      ],
      '/reference/': [
        {
          text: 'Technical reference',
          items: [
            link('braces', 'Overview', '/reference/'),
            link('settings', 'Environment variables', '/reference/environment'),
            link('braces', 'HTTP API', '/reference/api'),
            link('terminal', 'Scripts', '/reference/scripts'),
            link('database', 'Data model', '/reference/data-model'),
          ],
        },
      ],
      '/project/': [
        {
          text: 'Contributing',
          items: [
            link('folder-git-2', 'Start contributing', '/project/'),
            link('network', 'Architecture', '/project/architecture'),
            link('lock', 'Security model', '/project/security'),
            link('hammer', 'Development workflow', '/project/development'),
            link('shield-check', 'Compatibility policy', '/project/compatibility'),
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
      message: 'Open source link management for teams. Released under the MIT License.',
      copyright: 'Copyright © 2026-present Hamed Niroomand',
    },
  },
});
