<script setup lang="ts">
  import { useData } from 'vitepress';
  import { onMounted, ref, watch } from 'vue';

  const props = defineProps<{ code: string }>();

  const { isDark } = useData();
  const host = ref<HTMLElement>();
  const id = `aw-mermaid-${Math.random().toString(36).slice(2)}`;

  // Mermaid is browser only and large. Load it on the first diagram, not in the
  // page bundle, and redraw when the reader switches the color scheme.
  async function draw(): Promise<void> {
    if (!host.value) return;
    const { default: mermaid } = await import('mermaid');
    // Mermaid measures labels with the font it is told about, then the page
    // renders them. Give it the page font and colors so the two agree.
    const style = getComputedStyle(document.documentElement);
    const token = (name: string) => style.getPropertyValue(name).trim();
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      fontFamily: token('--vp-font-family-base'),
      themeVariables: {
        darkMode: isDark.value,
        fontFamily: token('--vp-font-family-base'),
        fontSize: '14px',
        background: token('--vp-c-bg'),
        primaryColor: token('--vp-c-bg-soft'),
        primaryTextColor: token('--vp-c-text-1'),
        primaryBorderColor: token('--vp-c-brand-1'),
        secondaryColor: token('--vp-c-bg-elv'),
        tertiaryColor: token('--vp-c-bg-alt'),
        lineColor: token('--vp-c-text-3'),
        textColor: token('--vp-c-text-1'),
        nodeBorder: token('--vp-c-brand-1'),
        clusterBkg: token('--vp-c-bg-alt'),
        clusterBorder: token('--vp-c-divider'),
        edgeLabelBackground: token('--vp-c-bg'),
      },
    });
    const { svg } = await mermaid.render(id, decodeURIComponent(props.code));
    host.value.innerHTML = svg;
  }

  onMounted(draw);
  watch(isDark, draw);
</script>

<template>
  <div
    ref="host"
    class="aw-mermaid"
  />
</template>
