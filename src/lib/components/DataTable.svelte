<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import SpinningCircle from '$lib/components/SpinningCircle.svelte';

	interface Column {
		label: string;
		class?: string;
		sortKey?: string; // Aktiviert clientseitige Sortierung nach diesem Objekt-Key
	}

	interface Props {
		columns: Column[];
		rows: T[];
		row: Snippet<[T]>;
		/** Optionaler Snippet für einen Custom-Card-Header oberhalb der Tabelle */
		header?: Snippet;
		empty?: Snippet;
		emptyMessage?: string;
		loading?: boolean;
		rowClass?: (item: T) => string;
		selectable?: boolean;
		selectedIds?: string[];
		getRowId?: (item: T) => string;
		isAllSelected?: boolean;
		onSelectAll?: (checked: boolean) => void;
		onSelectRow?: (id: string, checked: boolean) => void;
		selectAllDisabled?: boolean;
		/** Zusätzliche CSS-Klassen für den äußeren Wrapper (z.B. 'mt-12') */
		class?: string;
	}

	let {
		columns,
		rows,
		row,
		header,
		empty,
		emptyMessage = 'No entries found.',
		loading = false,
		rowClass,
		selectable = false,
		selectedIds = [],
		getRowId,
		isAllSelected = false,
		onSelectAll,
		onSelectRow,
		selectAllDisabled = false,
		class: extraClass = ''
	}: Props = $props();

	// ── Interne Sort-State ──
	let _sortKey = $state<string | null>(null);
	let _sortDir = $state<'asc' | 'desc'>('asc');

	function handleSort(key: string) {
		if (_sortKey === key) {
			_sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			_sortKey = key;
			_sortDir = 'asc';
		}
	}

	const sortedRows = $derived.by(() => {
		if (!_sortKey) return rows;
		const key = _sortKey;
		const dir = _sortDir;
		return [...rows].sort((a, b) => {
			const recordA = a as Record<string, unknown>;
			const recordB = b as Record<string, unknown>;
			const valueA = recordA[key];
			const valueB = recordB[key];
			
			if (valueA === valueB) return 0;
			if (valueA == null) return 1;
			if (valueB == null) return -1;
			const cmp = valueA < valueB ? -1 : 1;
			return dir === 'asc' ? cmp : -cmp;
		});
	});

	const totalCols = $derived(columns.length + (selectable ? 1 : 0));
</script>

<div class="overflow-hidden rounded-2xl border border-gray-800 bg-gray-800 shadow-2xl ring-1 ring-white/5 {extraClass}">
	{#if header}
		{@render header()}
	{/if}

	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm whitespace-nowrap">
			<!-- ── Header ── -->
			<thead>
				<tr class="bg-gray-900/50 text-[11px] font-bold uppercase tracking-widest text-gray-500">
					{#if selectable}
						<th class="px-6 py-5 w-10">
							<input
								type="checkbox"
								checked={isAllSelected}
								disabled={selectAllDisabled || rows.length === 0}
								onchange={(e) => onSelectAll?.((e.target as HTMLInputElement).checked)}
								class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
							/>
						</th>
					{/if}
					{#each columns as col (col.label)}
						<th
							class="px-8 py-5 {col.class ?? ''} {col.sortKey ? 'cursor-pointer select-none hover:text-gray-300 transition-colors' : ''}"
							onclick={col.sortKey ? () => handleSort(col.sortKey!) : undefined}
						>
							<span class="inline-flex items-center gap-1.5">
								{col.label}
								{#if col.sortKey}
									<span class="flex flex-col gap-px opacity-40 {_sortKey === col.sortKey ? 'opacity-100' : ''}">
										<svg class="h-2 w-2 {_sortKey === col.sortKey && _sortDir === 'asc' ? 'text-amber-400' : ''}" viewBox="0 0 8 5" fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
										<svg class="h-2 w-2 {_sortKey === col.sortKey && _sortDir === 'desc' ? 'text-amber-400' : ''}" viewBox="0 0 8 5" fill="currentColor"><path d="M4 5L0 0h8z"/></svg>
									</span>
								{/if}
							</span>
						</th>
					{/each}
				</tr>
			</thead>

			<!-- ── Body ── -->
			<tbody class="divide-y divide-gray-700/50">
				{#if loading}
					<tr>
						<td colspan={totalCols} class="px-8 py-12 text-center">
							<div class="flex items-center justify-center gap-3 text-gray-500">
								<SpinningCircle size="h-5 w-5" color="text-gray-500" />
								<span class="text-sm font-medium">Loading...</span>
							</div>
						</td>
					</tr>
				{:else if sortedRows.length === 0}
					<tr>
						<td colspan={totalCols} class="px-8 py-12 text-center">
							{#if empty}
								{@render empty()}
							{:else}
								<p class="text-sm italic text-gray-500">{emptyMessage}</p>
							{/if}
						</td>
					</tr>
				{:else}
					{#each sortedRows as item (getRowId ? getRowId(item) : JSON.stringify(item))}
						{@const extraRowClass = rowClass ? rowClass(item) : ''}
						<tr class="transition-all hover:bg-white/2 {extraRowClass}">
							{#if selectable && getRowId}
								{@const id = getRowId(item)}
								<td class="px-6 py-4">
									<input
										type="checkbox"
										checked={selectedIds.includes(id)}
										onchange={(e) => onSelectRow?.(id, (e.target as HTMLInputElement).checked)}
										class="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-500 focus:ring-0 cursor-pointer"
									/>
								</td>
							{/if}
							{@render row(item)}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>
</div>
