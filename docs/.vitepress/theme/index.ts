import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';

import BrandPattern from './components/BrandPattern.vue';
import Card from './components/Card.vue';
import CardGroup from './components/CardGroup.vue';
import Mermaid from './components/Mermaid.vue';
import ReadMore from './components/ReadMore.vue';
import Steps from './components/Steps.vue';
import Tab from './components/Tab.vue';
import Tabs from './components/Tabs.vue';

import './style.css';

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'home-hero-before': () => h(BrandPattern),
    });
  },
  enhanceApp({ app }) {
    app.component('Card', Card);
    app.component('CardGroup', CardGroup);
    app.component('Mermaid', Mermaid);
    app.component('ReadMore', ReadMore);
    app.component('Steps', Steps);
    app.component('Tab', Tab);
    app.component('Tabs', Tabs);
  },
} satisfies Theme;
