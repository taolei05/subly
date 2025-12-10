/// <reference types="@rsbuild/core/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  // biome-ignore lint/complexity/noBannedTypes: Vue standard type declaration
  // biome-ignore lint/suspicious/noExplicitAny: Vue standard type declaration
  const component: DefineComponent<{}, {}, any>;
  export default component;
}
