import type { H3Event } from 'h3';
import { setResponseHeader } from 'h3';
import { toCsv } from '#shared/csv';

export function csvResponse(event: H3Event, filename: string, rows: unknown[][]): string {
  const body = toCsv(rows);
  setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8');
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${filename.replaceAll('"', '')}"`);
  return body;
}
