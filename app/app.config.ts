export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate',
    },
    button: { slots: { base: 'font-medium cursor-pointer', leadingIcon: 'shrink-0' } },
    card: { slots: { root: 'rounded-xl shadow-none', header: 'border-default', body: 'sm:p-6' } },
    input: { slots: { root: 'w-full', base: 'rounded-lg' } },
    select: { slots: { base: 'rounded-lg' } },
    modal: { slots: { content: 'rounded-2xl', header: 'sm:px-6', body: 'sm:p-6', footer: 'sm:px-6' } },
    table: { slots: { root: 'rounded-xl border border-default bg-default', th: 'bg-muted/60 text-muted text-xs font-medium', td: 'py-4' } },
    navigationMenu: { slots: { link: 'py-2.5 px-3 rounded-lg', linkLeadingIcon: 'size-4' } },
    formField: {
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
