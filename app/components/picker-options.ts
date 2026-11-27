import type { ComboboxItem } from "@effect/ui-kit";

import type { FilterOptions } from "../search";
import { normalizeName } from "../utils/normalize";

type Options = typeof FilterOptions.Type;

export interface PickerIndex {
	readonly counts: ReadonlyMap<string, number>;
	readonly labels: ReadonlyMap<string, string>;
	readonly normalized: readonly string[];
}

interface QueryCacheEntry {
	readonly query: string;
	readonly filtered: readonly ComboboxItem[];
	readonly matchCount: number;
}

interface InternalPickerIndex extends PickerIndex {
	readonly withEmpty: Map<string, readonly ComboboxItem[]>;
	readonly lastQuery: Map<string, QueryCacheEntry>;
}

const indexCache = new WeakMap<Options, InternalPickerIndex>();

function getInternalIndex(options: Options): InternalPickerIndex {
	let cached = indexCache.get(options);
	if (cached === undefined) {
		const counts = new Map<string, number>();
		const labels = new Map<string, string>();
		const normalized = options.map((option) => {
			counts.set(option.value, option.count);
			labels.set(option.value, option.label);
			return normalizeName(option.label);
		});
		cached = {
			counts,
			labels,
			lastQuery: new Map(),
			normalized,
			withEmpty: new Map(),
		};
		indexCache.set(options, cached);
	}
	return cached;
}

export function getPickerIndex(options: Options): PickerIndex {
	return getInternalIndex(options);
}

export function getPickerItemsWithEmpty(
	options: Options,
	placeholder: string,
): readonly ComboboxItem[] {
	const index = getInternalIndex(options);
	let items = index.withEmpty.get(placeholder);
	if (items === undefined) {
		items = [{ label: placeholder, value: "" }, ...options];
		index.withEmpty.set(placeholder, items);
	}
	return items;
}

export function filterPickerOptions(
	options: Options,
	query: string,
	placeholder?: string,
): { readonly items: readonly ComboboxItem[]; readonly matchCount: number } {
	const index = getInternalIndex(options);
	const cacheKey = placeholder ?? "";
	const previous = index.lastQuery.get(cacheKey);
	if (previous !== undefined && previous.query === query) {
		return { items: previous.filtered, matchCount: previous.matchCount };
	}

	const normalizedQuery = normalizeName(query.trim());
	let filtered: readonly ComboboxItem[];
	let matchCount: number;

	if (!normalizedQuery) {
		matchCount = options.length;
		filtered = placeholder === undefined ? options : getPickerItemsWithEmpty(options, placeholder);
	} else {
		const matched: ComboboxItem[] =
			placeholder === undefined ? [] : [{ label: placeholder, value: "" }];
		for (let i = 0; i < options.length; i++) {
			if (index.normalized[i]!.includes(normalizedQuery)) {
				matched.push(options[i]!);
			}
		}
		matchCount = placeholder === undefined ? matched.length : matched.length - 1;
		filtered = matched;
	}

	index.lastQuery.set(cacheKey, { query, filtered, matchCount });
	return { items: filtered, matchCount };
}

export interface VirtualListMeta {
	readonly keys: readonly string[];
	readonly indexByValue: ReadonlyMap<string, number>;
	readonly dividerSizes: (
		rowHeight: number,
		rowGap: number,
		dividerHeight: number,
	) => readonly number[];
}

const virtualMetaCache = new WeakMap<readonly ComboboxItem[], VirtualListMeta>();

export function getVirtualListMeta(items: readonly ComboboxItem[]): VirtualListMeta {
	let cached = virtualMetaCache.get(items);
	if (cached === undefined) {
		const indexByValue = new Map<string, number>();
		const keys = items.map(({ value }, i) => {
			indexByValue.set(value, i);
			return value;
		});
		let sizes: readonly number[] | undefined;
		cached = {
			dividerSizes: (rowHeight, rowGap, dividerHeight) => {
				if (sizes === undefined) {
					const stride = rowHeight + rowGap;
					const firstRow = rowHeight + rowGap * 2 + dividerHeight;
					sizes = items.map((_, i) => (i === 0 ? firstRow : stride));
				}
				return sizes;
			},
			indexByValue,
			keys,
		};
		virtualMetaCache.set(items, cached);
	}
	return cached;
}
