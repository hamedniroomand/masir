export interface LinkItem {
  id: string;
  slug: string;
  title: string | null;
  destinationUrl: string;
  destinationHost: string;
  shortUrl: string;
  clickCount: number;
  status: 'active' | 'disabled' | 'expired';
  isEnabled: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useLinksList() {
  const route = useRoute();
  const q = computed({
    get: () => (route.query.q as string) ?? '',
    set: (v: string) => navigateTo({ query: { ...route.query, q: v || undefined, page: undefined } }),
  });
  const status = computed({
    get: () => (route.query.status as string) || 'all',
    set: (v: string) => navigateTo({
      query: { ...route.query, status: v === 'all' ? undefined : v, page: undefined },
    }),
  });
  const page = computed(() => Number(route.query.page ?? 1) || 1);

  const { data, pending, refresh } = useFetch(() => '/api/links', {
    query: computed(() => ({
      q: q.value || undefined,
      status: status.value === 'all' ? undefined : status.value,
      page: page.value,
      perPage: 20,
    })),
  });

  return { data, pending, refresh, q, status, page };
}
