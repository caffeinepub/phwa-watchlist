import { saveCoverIDB } from "./coverDb";

const MIGRATION_FLAG = "phwa_covers_migrated_v1";
const COVER_PREFIX = "manga_cover_";

export async function migrateCoversToIDB(): Promise<void> {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  const keysToMigrate: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(COVER_PREFIX)) keysToMigrate.push(key);
  }
  for (const key of keysToMigrate) {
    const val = localStorage.getItem(key);
    if (val) {
      const id = key.slice(COVER_PREFIX.length);
      await saveCoverIDB(id, val);
      localStorage.removeItem(key);
    }
  }
  localStorage.setItem(MIGRATION_FLAG, "1");
}
