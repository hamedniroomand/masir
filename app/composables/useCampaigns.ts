export interface CampaignItem {
  id: string;
  name: string;
  utmCampaign: string;
  utmMedium: string | null;
  linkCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useCampaignsList() {
  return useFetch<{ items: CampaignItem[]; total: number }>('/api/campaigns');
}

export function useCampaignOptions() {
  const { data, refresh } = useCampaignsList();
  const options = computed(() => [
    { label: 'No campaign', value: null },
    ...(data.value?.items ?? []).map(c => ({ label: c.name, value: c.id })),
  ]);
  const byId = computed(() => new Map((data.value?.items ?? []).map(c => [c.id, c])));
  return { options, byId, refresh };
}
