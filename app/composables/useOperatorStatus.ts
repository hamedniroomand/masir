export type OperatorJobItem = {
  job: string;
  lastStartedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  nextDueAt: string | null;
  overdue: boolean;
  status: 'ok' | 'failed';
  nextAction: string | null;
};

export type OperatorSignalItem = {
  key: string;
  state: string;
  detail: Record<string, unknown> | null;
  updatedAt: string;
};

export type OperatorStatusResponse = {
  version: string;
  jobs: OperatorJobItem[];
  signals: OperatorSignalItem[];
  partitionsReadyThrough: string | null;
};

export function useOperatorStatus() {
  const { data, pending, error, refresh } = useApi<OperatorStatusResponse>('/api/admin/status', {
    key: 'operator-status',
  });

  const isOperator = computed(() => Boolean(data.value?.version));

  return {
    adminStatus: data,
    isOperator,
    pending,
    error,
    refresh,
  };
}
