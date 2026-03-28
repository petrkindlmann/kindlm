import { getOrgQueries } from "./orgs.js";
import { getUserQueries } from "./users.js";
import { getProjectQueries } from "./projects.js";
import { getTestingQueries } from "./testing.js";
import { getAuthQueries } from "./auth.js";
import { getBillingQueries } from "./billing.js";

export function getQueries(db: D1Database) {
  return {
    ...getOrgQueries(db),
    ...getUserQueries(db),
    ...getProjectQueries(db),
    ...getTestingQueries(db),
    ...getAuthQueries(db),
    ...getBillingQueries(db),
  };
}

export type Queries = ReturnType<typeof getQueries>;
