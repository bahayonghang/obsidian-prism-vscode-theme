/** Reversible, leaf-level settings ownership. Never copy effective workspace values into user settings. */
import { isRecord } from './config';

export type Snapshot = { present: false } | { present: true; value: unknown };
export interface LeafPatch { path: string[]; value: unknown }
export interface OwnedLeaf { path: string[]; before: Snapshot; applied: Snapshot; pending?: Snapshot; detached?: boolean }
export interface OwnedRoot { existed: boolean; leaves: OwnedLeaf[] }
export interface Ledger { version: 1; groups: Record<string, Record<string, OwnedRoot>> }
export interface SettingsStore {
  read(key: string): unknown;
  write(key: string, value: unknown): PromiseLike<void>;
  load(): Ledger | undefined;
  save(value: Ledger): PromiseLike<void>;
}

export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
  }
  return false;
}
function clone<T>(value: T): T { return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T; }
function snapshot(value: unknown): Snapshot { return value === undefined ? { present: false } : { present: true, value: clone(value) }; }
function readPath(root: unknown, path: string[]): Snapshot {
  let value = root;
  for (const key of path) {
    if (!isRecord(value) || !Object.hasOwn(value, key)) return { present: false };
    value = value[key];
  }
  return snapshot(value);
}
function writePath(root: unknown, path: string[], next: Snapshot): unknown {
  if (path.length === 0) return next.present ? clone(next.value) : undefined;
  const result: Record<string, unknown> = isRecord(root) ? { ...root } : {};
  const [key, ...rest] = path;
  if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Unsafe setting path');
  const child = writePath(result[key], rest, next);
  if (child === undefined || (rest.length > 0 && isRecord(child) && Object.keys(child).length === 0)) delete result[key];
  else result[key] = child;
  return result;
}
const pathKey = (path: string[]) => JSON.stringify(path);
const stillOwned = (now: Snapshot, leaf: OwnedLeaf) => !leaf.detached && (equal(now, leaf.applied) || (leaf.pending !== undefined && equal(now, leaf.pending)));

/** A manual edit relinquishes ownership until reset, so subsequent automatic updates do not undo it. */
export function reconcile(current: unknown, patches: LeafPatch[], previous?: OwnedRoot): { value: unknown; owned?: OwnedRoot; conflicts: string[] } {
  if (patches.some(p => p.path.length > 0) && current !== undefined && !isRecord(current)) throw new Error('Expected an object in the existing color customization setting.');
  for (const patch of patches) {
    let ancestor = current;
    for (const key of patch.path) {
      if (ancestor === undefined) break;
      if (!isRecord(ancestor)) throw new Error('Expected an object in an existing customization ancestor.');
      ancestor = ancestor[key];
    }
  }
  let value = clone(current);
  const remaining = new Map(patches.map(p => [pathKey(p.path), p]));
  const leaves: OwnedLeaf[] = [];
  const conflicts: string[] = [];
  for (const old of previous?.leaves ?? []) {
    const key = pathKey(old.path);
    const patch = remaining.get(key);
    remaining.delete(key);
    const now = readPath(current, old.path);
    if (!stillOwned(now, old)) {
      if (patch) leaves.push({ ...old, pending: undefined, detached: true });
      conflicts.push(old.path.join('.'));
      continue;
    }
    if (patch) {
      const next = snapshot(patch.value);
      value = writePath(value, old.path, next);
      leaves.push({ ...old, applied: next, pending: undefined });
    } else {
      value = writePath(value, old.path, old.before);
    }
  }
  for (const patch of remaining.values()) {
    const before = readPath(value, patch.path);
    const applied = snapshot(patch.value);
    if (equal(before, applied)) continue;
    value = writePath(value, patch.path, applied);
    leaves.push({ path: patch.path, before, applied });
  }
  const existed = previous?.existed ?? current !== undefined;
  if (!existed && isRecord(value) && Object.keys(value).length === 0) value = undefined;
  return { value, owned: leaves.length ? { existed, leaves } : undefined, conflicts };
}

/** Callers serialize operations. Write-ahead ownership keeps originals recoverable after a failed update. */
export class AppearanceOwnership {
  constructor(private readonly store: SettingsStore) {}
  has(group: string): boolean {
    return Object.values(this.store.load()?.groups[group] ?? {}).some(root => root.leaves.some(leaf => !leaf.detached));
  }
  original(group: string, key: string, path: string[]): Snapshot | undefined {
    const leaf = this.store.load()?.groups[group]?.[key]?.leaves.find(entry => equal(entry.path, path));
    return leaf ? clone(leaf.before) : undefined;
  }
  async apply(group: string, patches: Record<string, LeafPatch[]>): Promise<string[]> {
    const ledger = clone(this.store.load() ?? { version: 1, groups: {} } as Ledger);
    const oldGroup = ledger.groups[group] ?? {};
    const nextGroup: Record<string, OwnedRoot> = {};
    const changes: { key: string; value: unknown }[] = [];
    const currentRoots: Record<string, unknown> = {};
    const conflicts: string[] = [];
    for (const key of new Set([...Object.keys(oldGroup), ...Object.keys(patches)])) {
      const current = this.store.read(key);
      currentRoots[key] = current;
      const result = reconcile(current, patches[key] ?? [], oldGroup[key]);
      if (result.owned) nextGroup[key] = result.owned;
      if (!equal(current, result.value)) changes.push({ key, value: result.value });
      conflicts.push(...result.conflicts.map(path => `${key}${path ? '.' + path : ''}`));
    }
    // Keep old ownership through restoration writes: failure must not discard the only backup.
    const journal: Record<string, OwnedRoot> = {};
    for (const key of new Set([...Object.keys(oldGroup), ...Object.keys(nextGroup)])) {
      const oldRoot = oldGroup[key];
      const nextRoot = nextGroup[key];
      const oldLeaves = new Map((oldRoot?.leaves ?? []).map(leaf => [pathKey(leaf.path), leaf]));
      const nextLeaves = new Map((nextRoot?.leaves ?? []).map(leaf => [pathKey(leaf.path), leaf]));
      const leaves: OwnedLeaf[] = [];
      for (const path of new Set([...oldLeaves.keys(), ...nextLeaves.keys()])) {
        const before = oldLeaves.get(path);
        const after = nextLeaves.get(path);
        const basis = (after ?? before)!;
        const now = readPath(currentRoots[key], basis.path);
        const owned = !after?.detached && (!before || stillOwned(now, before));
        leaves.push({ ...basis, before: before?.before ?? basis.before, applied: owned ? now : basis.applied, pending: owned ? (after?.applied ?? before!.before) : undefined, detached: !owned });
      }
      journal[key] = { existed: (oldRoot ?? nextRoot).existed, leaves };
    }
    ledger.groups[group] = journal;
    await this.store.save(ledger);
    for (const change of changes) await this.store.write(change.key, change.value);
    if (Object.keys(nextGroup).length) ledger.groups[group] = nextGroup;
    else delete ledger.groups[group];
    await this.store.save(ledger);
    return conflicts;
  }
  restore(group: string): Promise<string[]> { return this.apply(group, {}); }
}
