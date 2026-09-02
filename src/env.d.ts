/**
 * Type declarations for imports TypeScript cannot resolve on its own.
 *
 * `bigger-picture/css` is a stylesheet exposed through the package's exports
 * map; there is nothing for TypeScript to find. Declaring it here keeps the
 * import honest at the call site instead of scattering @ts-expect-error.
 */
declare module 'bigger-picture/css';

/**
 * GTranslate's facade (`LanguageSwitcher.astro`) drives Google's translate
 * element, which arrives as a global rather than a module. Only the two
 * members we touch are declared — the widget's full surface is neither
 * documented nor stable.
 */
declare interface Window {
  googleTranslateElementInit2?: () => void;
  google?: {
    translate: {
      TranslateElement: new (
        options: { pageLanguage: string; autoDisplay: boolean },
        container: string,
      ) => unknown;
    };
  };
}

/** Save-Data and the effective connection type; still not in lib.dom. */
declare interface Navigator {
  connection?: { saveData?: boolean; effectiveType?: string };
}
