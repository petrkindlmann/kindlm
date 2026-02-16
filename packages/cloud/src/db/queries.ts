export function getQueries(_db: D1Database) {
  return {
    getOrg(_id: string): Promise<unknown> {
      throw new Error("Not implemented");
    },
    getProject(_id: string): Promise<unknown> {
      throw new Error("Not implemented");
    },
    getRun(_id: string): Promise<unknown> {
      throw new Error("Not implemented");
    },
  };
}
