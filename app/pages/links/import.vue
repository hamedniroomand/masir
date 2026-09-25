<script setup lang="ts">
import type { LinkImportValues } from '#shared/link-import';
import { LINK_IMPORT_COLUMNS } from '#shared/link-import';

definePageMeta({ layout: 'default' });
useHead({ title: 'Import links · Masir' });

const { canManageLinks } = useCurrentWorkspace();
const { $api } = useNuxtApp();
const showError = useErrorToast();
const toast = useToast();

type PreviewRow = {
  row: number;
  values: LinkImportValues;
  errors: string[];
};

type ImportResult = {
  row: number;
  status: 'created' | 'already_imported' | 'conflict' | 'error';
  linkId?: string;
  error?: string;
};

const file = ref<File | null>(null);
const previewing = ref(false);
const importing = ref(false);
const importId = ref('');
const fileHash = ref('');
const previewRows = ref<PreviewRow[]>([]);
const results = ref<ImportResult[]>([]);

const validRows = computed(() => previewRows.value.filter(row => row.errors.length === 0));
const invalidRows = computed(() => previewRows.value.filter(row => row.errors.length > 0));
const errorResults = computed(() => results.value.filter(row => row.status === 'error'));

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
  importId.value = '';
  fileHash.value = '';
  previewRows.value = [];
  results.value = [];
}

async function runPreview() {
  if (!file.value)
    return;
  previewing.value = true;
  results.value = [];
  try {
    const body = new FormData();
    body.set('file', file.value);
    const res = await $api<{
      importId: string;
      fileHash: string;
      rows: PreviewRow[];
    }>('/api/links/import/preview', { method: 'POST', body });
    importId.value = res.importId;
    fileHash.value = res.fileHash;
    previewRows.value = res.rows;
  }
  catch (error) {
    showError(error);
  }
  finally {
    previewing.value = false;
  }
}

async function runImport(rows: PreviewRow[]) {
  if (!importId.value || !fileHash.value || !rows.length)
    return;
  importing.value = true;
  try {
    const res = await $api<{ results: ImportResult[] }>('/api/links/import', {
      method: 'POST',
      body: {
        importId: importId.value,
        fileHash: fileHash.value,
        rows: rows.map(row => ({ row: row.row, values: row.values })),
      },
    });
    const byRow = new Map(results.value.map(row => [row.row, row]));
    for (const row of res.results)
      byRow.set(row.row, row);
    results.value = [...byRow.values()].sort((a, b) => a.row - b.row);
    const created = res.results.filter(row => row.status === 'created').length;
    toast.add({ title: created ? `Created ${created} links.` : 'Import finished.', color: 'success' });
  }
  catch (error) {
    showError(error);
  }
  finally {
    importing.value = false;
  }
}

function resultFor(row: number) {
  return results.value.find(item => item.row === row);
}

function statusLabel(status: ImportResult['status']) {
  if (status === 'created')
    return 'Created';
  if (status === 'already_imported')
    return 'Already imported';
  if (status === 'conflict')
    return 'Conflict';
  return 'Error';
}
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <UButton to="/" label="All links" icon="i-lucide-arrow-left" color="neutral" variant="link" size="sm" class="p-0" />
    <div class="page-heading">
      <div>
        <h1 class="page-title">
          Import links
        </h1>
        <p class="page-description">
          Upload a CSV, review row errors, then import. Download the
          <a href="/templates/links-import.csv" class="text-primary underline underline-offset-2">template</a>.
        </p>
      </div>
    </div>

    <UAlert
      v-if="!canManageLinks"
      title="You can only read this workspace"
      description="Ask an owner or a member to import links for you."
      color="error"
      variant="soft"
      icon="i-lucide-circle-alert"
    />

    <div v-else class="space-y-6">
      <div class="surface space-y-4 p-5">
        <div class="flex flex-wrap items-end gap-3">
          <div class="space-y-1.5">
            <label class="text-sm font-medium text-highlighted" for="import-file">CSV file</label>
            <input
              id="import-file"
              type="file"
              accept=".csv,text/csv"
              class="block text-sm"
              @change="onFileChange"
            >
          </div>
          <UButton
            label="Preview"
            icon="i-lucide-eye"
            :loading="previewing"
            :disabled="!file"
            @click="runPreview"
          />
          <UButton
            label="Import valid rows"
            icon="i-lucide-upload"
            color="primary"
            :loading="importing"
            :disabled="!validRows.length || !importId"
            @click="runImport(validRows)"
          />
        </div>
        <p v-if="previewRows.length" class="text-sm text-muted">
          {{ validRows.length }} ready, {{ invalidRows.length }} with errors.
        </p>
      </div>

      <div v-if="previewRows.length" class="surface overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="border-b border-default bg-muted/30 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="px-3 py-2">
                Row
              </th>
              <th class="px-3 py-2">
                Slug
              </th>
              <th class="px-3 py-2">
                Destination
              </th>
              <th class="px-3 py-2">
                Title
              </th>
              <th class="px-3 py-2">
                Errors
              </th>
              <th class="px-3 py-2">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in previewRows"
              :key="row.row"
              class="border-b border-default align-top"
              :class="row.errors.length ? 'bg-error/5' : ''"
            >
              <td class="px-3 py-2 font-mono text-xs">
                {{ row.row }}
              </td>
              <td class="px-3 py-2 font-mono text-xs">
                {{ row.values.slug || '—' }}
              </td>
              <td class="px-3 py-2 max-w-xs truncate">
                {{ row.values.destination_url || '—' }}
              </td>
              <td class="px-3 py-2">
                {{ row.values.title || '—' }}
              </td>
              <td class="px-3 py-2 text-error">
                <span v-if="row.errors.length">{{ row.errors.join(' ') }}</span>
                <span v-else class="text-muted">—</span>
              </td>
              <td class="px-3 py-2">
                <template v-if="resultFor(row.row)">
                  <span>{{ statusLabel(resultFor(row.row)!.status) }}</span>
                  <span v-if="resultFor(row.row)!.error" class="block text-error">{{ resultFor(row.row)!.error }}</span>
                </template>
                <span v-else class="text-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="errorResults.length" class="surface space-y-3 p-5">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-sm text-highlighted">
            {{ errorResults.length }} rows failed. Retry only those rows.
          </p>
          <UButton
            label="Retry failed rows"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="importing"
            @click="runImport(previewRows.filter(row => errorResults.some(item => item.row === row.row)))"
          />
        </div>
      </div>

      <p class="text-xs text-muted">
        Columns: {{ LINK_IMPORT_COLUMNS.join(', ') }}. Dates use ISO 8601 with an offset or Z. Tags use `|`.
      </p>
    </div>
  </div>
</template>
