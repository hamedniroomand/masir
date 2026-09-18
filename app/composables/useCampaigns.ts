export type CampaignItem = {
  id: string;
  name: string;
  utmCampaign: string;
  utmMedium: string | null;
  linkCount: number;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
};

export function useCampaignsList() {
  return useApi<{ items: CampaignItem[]; total: number }>('/api/campaigns');
}

export function useCampaignOptions() {
  const { data, refresh } = useCampaignsList();
  const options = computed(() => [
    { label: 'No campaign', value: null },
    ...(data.value?.items ?? []).map(item => ({ label: item.name, value: item.id })),
  ]);
  const byId = computed(() => new Map((data.value?.items ?? []).map(item => [item.id, item])));
  return { options, byId, refresh };
}
