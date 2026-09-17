import type { ComputedRef, InjectionKey, Ref } from 'vue';

export type TabsApi = {
  // Labels in document order.
  // ponytail: a tab finds itself by the index of its label, so two tabs with
  // one label both stay open and nothing reports it. Upgrade path: pass an
  // explicit index from Tabs to each child.
  labels: ComputedRef<string[]>;
  active: Ref<number>;
}

export const TABS: InjectionKey<TabsApi> = Symbol('aw-tabs');
