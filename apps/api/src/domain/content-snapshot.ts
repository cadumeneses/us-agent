import { createHash } from 'node:crypto';

export const JSON_HASH_FORMAT = 'us-agent-json-v1' as const;

// This is a local, versioned format, not an implementation of RFC 8785.
// Serialize keys ourselves: JSON.stringify(object) would reorder integer keys.
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function serialize(item: unknown, depth: number): string {
    if (depth > 100) throw new Error('JSON excede 100 níveis.');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return JSON.stringify(item);
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || item === null) throw new Error('Snapshot aceita somente valores JSON finitos.');
    if (ancestors.has(item)) throw new Error('Snapshot não aceita referências circulares.');
    if (Object.getOwnPropertySymbols(item).length) throw new Error('Snapshot não aceita propriedades Symbol.');
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        if (Object.getOwnPropertyNames(item).length !== item.length + 1) throw new Error('Array deve ser denso e sem propriedades extras.');
        return '[' + Array.from({ length: item.length }, (_, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('Array deve conter apenas valores JSON.');
          return serialize(descriptor.value, depth + 1);
        }).join(',') + ']';
      }
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error('Snapshot requer objetos JSON simples.');
      return '{' + Object.getOwnPropertyNames(item).sort(compareCodePoints).map(key => {
        const descriptor = Object.getOwnPropertyDescriptor(item, key)!;
        if (!('value' in descriptor) || !descriptor.enumerable) throw new Error('Snapshot não aceita getters ou propriedades ocultas.');
        return JSON.stringify(key) + ':' + serialize(descriptor.value, depth + 1);
      }).join(',') + '}';
    } finally {
      ancestors.delete(item);
    }
  }
  return serialize(value, 0);
}

function compareCodePoints(a: string, b: string): number {
  const left = Array.from(a, character => character.codePointAt(0)!);
  const right = Array.from(b, character => character.codePointAt(0)!);
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

export function freezeJson<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeJson(child);
    Object.freeze(value);
  }
  return value;
}

export type ContentSnapshot<T> = { format: typeof JSON_HASH_FORMAT; sha256: string; content: T };

export function snapshotContent<T>(value: T): ContentSnapshot<T> {
  const serialized = canonicalJson(value);
  return freezeJson({ format: JSON_HASH_FORMAT,
    sha256: createHash('sha256').update(serialized, 'utf8').digest('hex'),
    content: JSON.parse(serialized) as T });
}
