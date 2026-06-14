/// <reference types="vite/client" />

declare namespace JSX {
  interface IntrinsicElements {
    "phantom-ui": React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        loading?: boolean;
        animation?: string;
        "shimmer-direction"?: string;
        "background-color"?: string;
        "shimmer-color"?: string;
        duration?: number;
        "fallback-radius"?: number;
        stagger?: number;
        reveal?: number;
        count?: number;
        "count-gap"?: number;
        debug?: boolean;
        "loading-label"?: string;
        class?: string;
      },
      HTMLElement
    >;
  }
}
