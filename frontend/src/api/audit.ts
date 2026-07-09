import { getMockAuditLogs, type AuditRecord } from './mock';

export function getAuditLogs(): Promise<AuditRecord[]> {
  return Promise.resolve(getMockAuditLogs());
}
