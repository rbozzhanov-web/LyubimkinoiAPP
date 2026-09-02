declare module 'pdfjs-dist/webpack.mjs' {
  export function getDocument(source: unknown): { promise: Promise<any> };
}
