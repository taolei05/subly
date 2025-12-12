/// <reference types="@rsbuild/core/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  // biome-ignore lint/complexity/noBannedTypes: Vue standard type declaration
  // biome-ignore lint/suspicious/noExplicitAny: Vue standard type declaration
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module 'markdown-it' {
  interface MarkdownIt {
    render(src: string): string;
  }
  interface MarkdownItConstructor {
    new (): MarkdownIt;
  }
  const MarkdownIt: MarkdownItConstructor;
  export default MarkdownIt;
}
