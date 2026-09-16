export interface LinkItem {
  id: string;
  slug: string;
  title: string | null;
  destinationUrl: string;
  destinationHost: string;
  shortUrl: string;
  clickCount: number;
  campaignId: string | null;
  utmSource: string | null;
  utmContent: string | null;
  status: 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';
  isEnabled: boolean;
  isProtected: boolean;
  expiresAt: string | null;
  startsAt: string | null;
  expirationDestination: string | null;
  maximumVisits: number | null;
  successfulVisitCount: number;
  tags: string[];
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
  const page = computed({
    get: () => Math.max(1, Number(route.query.page ?? 1) || 1),
    set: (v: number) => navigateTo({ query: { ...route.query, page: v === 1 ? undefined : v } }),
  });
  const sort = computed({
    get: () => route.query.sort === 'clicks' ? 'clicks' : 'createdAt',
    set: (v: string) => navigateTo({ query: { ...route.query, sort: v === 'clicks' ? v : undefined, page: undefined } }),
  });

  const selectedTags = computed({
    get: () => {
      const raw = route.query.tags;
      if (Array.isArray(raw))
        return raw.filter((t): t is string => typeof t === 'string');
      return typeof raw === 'string' ? [raw] : [];
    },
    set: (tags: string[]) => navigateTo({
      query: {
        ...route.query,
        tags: tags.length ? tags : undefined,
        page: undefined,
      },
    }),
  });

  const { data, pending, refresh, error } = useFetch(() => '/api/links', {
    query: computed(() => ({
      q: q.value || undefined,
      status: status.value === 'all' ? undefined : status.value,
      tags: selectedTags.value.length ? selectedTags.value : undefined,
      page: page.value,
      perPage: 20,
      sort: sort.value,
    })),
  });

  const { data: tagList } = useFetch<{ items: { name: string }[] }>(() => '/api/tags');

  function toggleTag(name: string) {
    const set = new Set(selectedTags.value);
    if (set.has(name))
      set.delete(name);
    else
      set.add(name);
    selectedTags.value = [...set];
  }

  return { data, pending, refresh, error, q, status, page, sort, selectedTags, tagList, toggleTag };
}
