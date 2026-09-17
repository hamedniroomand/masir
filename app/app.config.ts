export default defineAppConfig({
  ui: {
    colors: {
      primary: 'violet',
      neutral: 'zinc',
    },
    button: {
      slots: { base: 'font-medium cursor-pointer transition-colors', leadingIcon: 'shrink-0' },
      variants: {
        size: {
          sm: { base: 'px-2.5 py-1.5 text-xs gap-1.5' },
          md: { base: 'px-3 py-2 text-[13px] gap-2', leadingIcon: 'size-4', trailingIcon: 'size-4' },
        },
      },
      compoundVariants: [
        { color: 'primary', variant: 'solid', class: 'brand-action text-white dark:text-zinc-950 shadow-control ring-1 ring-inset ring-black/10 hover:bg-primary/90' },
        { color: 'primary', variant: 'solid', block: true, class: 'brand-action-form' },
        { loading: true, leading: true, class: { leadingIcon: 'animate-none brand-loader' } },
        { loading: true, leading: false, trailing: true, class: { trailingIcon: 'animate-none brand-loader' } },
        { color: 'neutral', variant: 'outline', class: 'bg-default shadow-control hover:bg-muted' },
      ],
    },
    card: { slots: { root: 'rounded-panel shadow-none', header: 'border-default bg-muted/40 p-5 sm:px-6 sm:py-5', body: 'p-5 sm:p-6', footer: 'bg-muted/30 p-4 sm:px-6 sm:py-4' } },
    input: { slots: { root: 'w-full', base: 'text-[13px] shadow-control', leadingIcon: 'size-4 text-muted' } },
    select: { slots: { base: 'cursor-pointer text-[13px] shadow-control', leadingIcon: 'size-4', trailingIcon: 'size-4 text-muted' } },
    modal: { slots: { content: 'rounded-panel' } },
    slideover: { slots: { overlay: 'bg-zinc-950/20 dark:bg-black/50 backdrop-blur-[2px]', header: 'p-6 bg-muted/60 min-h-24', title: 'text-base font-semibold tracking-tight', description: 'text-xs leading-5 max-w-80', body: 'p-6', footer: 'bg-muted/50 p-4 sm:px-6 justify-end', close: 'top-5 end-5' } },
    table: { slots: { root: 'rounded-panel border border-default bg-default', th: 'bg-muted/70 text-muted text-xs font-medium px-5 py-3', td: 'px-5 py-4 text-[13px]', tr: 'hover:bg-muted/50 transition-colors' } },
    navigationMenu: { slots: { link: 'py-2 px-3 text-[13px] rounded-md', linkLeadingIcon: 'size-4' } },
    tabs: { slots: { trigger: 'text-[13px] font-medium', leadingIcon: 'size-4' } },
    dropdownMenu: { slots: { content: 'rounded-lg shadow-lg', item: 'text-[13px] py-2', itemLeadingIcon: 'size-4' } },
    formField: {
      slots: { label: 'text-[13px] font-medium', description: 'text-xs leading-5', error: 'text-xs' },
      variants: {
        required: {
          true: {
            label: 'after:content-[\'*\'] after:ms-0.5 after:text-muted',
          },
        },
      },
    },
  },
});
