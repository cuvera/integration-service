declare module "better-opn" {
  function open(target: string, options?: { app?: string | string[] }): void;
  export = open;
}