/**
 * Type declarations for imports TypeScript cannot resolve on its own.
 *
 * `bigger-picture/css` is a stylesheet exposed through the package's exports
 * map; there is nothing for TypeScript to find. Declaring it here keeps the
 * import honest at the call site instead of scattering @ts-expect-error.
 */
declare module 'bigger-picture/css';
