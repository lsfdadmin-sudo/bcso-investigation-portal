declare module "node:sqlite" {
  type SqlParam = string | number | bigint | null | Uint8Array;

  export class StatementSync {
    run(...params: SqlParam[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: SqlParam[]): unknown;
    all(...params: SqlParam[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
