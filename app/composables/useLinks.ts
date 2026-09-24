export type LinkItem = {
  id: string;
  slug: string;
  title: string | null;
  notes: string | null;
  destinationUrl: string;
  destinationHost: string;
  shortUrl: string;
  clickCount: number;
  campaignId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  status: 'active' | 'disabled' | 'expired' | 'limit_reached' | 'scheduled';
  isEnabled: boolean;
  isProtected: boolean;
  expiresAt: string | null;
  startsAt: string | null;
  expirationDestination: string | null;
  limitDestination: string | null;
  scheduledDestination: string | null;
  targeting: { os?: Record<string, string>; country?: Record<string, string> } | null;
  maximumVisits: number | null;
  successfulVisitCount: number;
  tags: string[];
  aliases: string[];
  responsibleUserId: string | null;
  reviewAt: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  // Only the detail route sends this.
  creator?: { email: string; firstName: string | null; lastName: string | null } | null;
};

export type LinkListFilter = {
  q?: string;
  status?: string;
  tags?: string[];
  campaignId?: string;
  createdBy?: string;
  archived?: boolean;
  needsReview?: boolean;
  sort?: string;
};

export function useLinksList() {
  const route = useRoute();
  const search = computed({
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
        return raw.filter((tag): tag is string => typeof tag === 'string');
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

  const campaignId = computed({
    get: () => (route.query.campaignId as string) || 'all',
    set: (v: string) => navigateTo({
      query: { ...route.query, campaignId: !v || v === 'all' ? undefined : v, page: undefined },
    }),
  });

  const createdBy = computed({
    get: () => (route.query.createdBy as string) || 'all',
    set: (v: string) => navigateTo({
      query: { ...route.query, createdBy: !v || v === 'all' ? undefined : v, page: undefined },
    }),
  });

  const archived = computed(() => route.query.archived === 'true');
  const needsReview = computed(() => route.query.needsReview === 'true');

  const listFilter = computed<LinkListFilter>(() => ({
    q: search.value || undefined,
    status: status.value === 'all' ? undefined : status.value,
    tags: selectedTags.value.length ? selectedTags.value : undefined,
    campaignId: campaignId.value === 'all' ? undefined : campaignId.value,
    createdBy: createdBy.value === 'all' ? undefined : createdBy.value,
    archived: archived.value || undefined,
    needsReview: needsReview.value || undefined,
    sort: sort.value,
  }));

  const { data, pending, refresh, error } = useApi(() => '/api/links', {
    query: computed(() => ({
      q: search.value || undefined,
      status: status.value === 'all' ? undefined : status.value,
      tags: selectedTags.value.length ? selectedTags.value : undefined,
      campaignId: campaignId.value === 'all' ? undefined : campaignId.value,
      createdBy: createdBy.value === 'all' ? undefined : createdBy.value,
      archived: archived.value ? 'true' : undefined,
      needsReview: needsReview.value ? 'true' : undefined,
      page: page.value,
      perPage: 20,
      sort: sort.value,
    })),
  });

  const { data: tagList } = useApi<{ items: { id: string; name: string }[] }>(() => '/api/tags');

  function toggleTag(name: string) {
    const set = new Set(selectedTags.value);
    if (set.has(name))
      set.delete(name);
    else
      set.add(name);
    selectedTags.value = [...set];
  }

  return {
    data,
    pending,
    refresh,
    error,
    search,
    status,
    page,
    sort,
    selectedTags,
    campaignId,
    createdBy,
    archived,
    needsReview,
    listFilter,
    tagList,
    toggleTag,
  };
}
