<script setup lang="ts">
  // The same route pattern the app draws behind its sign-in pages, so the two
  // sites read as one product. The id is fixed: the pattern renders once.
  const patternId = 'masir-routes-docs';
</script>

<template>
  <svg
    aria-hidden="true"
    focusable="false"
    class="aw-brand-pattern"
  >
    <defs>
      <pattern
        :id="patternId"
        width="360"
        height="240"
        patternUnits="userSpaceOnUse"
      >
        <g
          fill="none"
          stroke="currentColor"
          stroke-width="1"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M28 48h60a16 16 0 0 1 16 16v32a16 16 0 0 0 16 16h60" />
          <path d="M220 28v36a16 16 0 0 0 16 16h60a16 16 0 0 1 16 16v32" />
          <path
            d="M28 192h28a16 16 0 0 0 16-16v-16a16 16 0 0 1 16-16h44"
            opacity="0.5"
          />
          <path
            d="M180 204h48a16 16 0 0 0 16-16v-28a16 16 0 0 1 16-16h20"
            opacity="0.5"
          />
          <circle cx="24" cy="48" r="4" />
          <circle cx="184" cy="112" r="4" />
          <circle cx="220" cy="24" r="4" />
          <circle cx="312" cy="132" r="4" />
          <circle cx="24" cy="192" r="4" opacity="0.5" />
          <circle cx="136" cy="144" r="4" opacity="0.5" />
          <circle cx="176" cy="204" r="4" opacity="0.5" />
          <circle cx="284" cy="144" r="4" opacity="0.5" />
          <path d="m164 108 4 4-4 4m144-28 4 4 4-4" />
        </g>
      </pattern>
    </defs>
    <rect
      width="100%"
      height="100%"
      :fill="`url(#${patternId})`"
    />
  </svg>
</template>
