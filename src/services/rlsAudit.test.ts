import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Static RLS audit test.
 *
 * These checks run against the SQL files in the repo, not the live database.
 * They catch the most common RLS anti-pattern that blocked login:
 * a SELECT policy on a table that itself SELECTs from the same table.
 */

const sqlFiles = fs
  .readdirSync(path.resolve(__dirname, "../../supabase"))
  .filter((f) => f.endsWith(".sql"))
  .map((f) => ({
    name: f,
    content: fs.readFileSync(path.resolve(__dirname, "../../supabase", f), "utf-8"),
  }));

const allSql = sqlFiles.map((f) => f.content).join("\n\n");

describe("RLS audit: static SQL checks", () => {
  it("has a SECURITY DEFINER is_trainer() function", () => {
    expect(allSql).toMatch(/create\s+or\s+replace\s+function\s+public\.is_trainer\s*\(\s*\)/i);
    expect(allSql).toMatch(/security\s+definer/i);
  });

  it("profiles SELECT policy uses is_trainer(), not a self-referencing EXISTS", () => {
    // The original bug: SELECT policy on profiles subqueries profiles -> infinite recursion.
    const profilesSelectPolicy = allSql.match(
      /CREATE\s+POLICY\s+"Trainers\s+can\s+read\s+all\s+profiles"\s+ON\s+profiles\s+FOR\s+SELECT[\s\S]*?USING\s*\([\s\S]*?\);/i
    );
    expect(profilesSelectPolicy).toBeTruthy();
    expect(profilesSelectPolicy?.[0]).toMatch(/public\.is_trainer\s*\(\s*\)/i);
    expect(profilesSelectPolicy?.[0]).not.toMatch(/EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+profiles\s+WHERE\s+id\s*=\s*auth\.uid\(\)/i);
  });

  it("no SELECT policy selects from its own table (self-referencing recursion guard)", () => {
    // Extract every CREATE POLICY ... ON table_name FOR SELECT ... USING (...) ;
    const selectPolicies = allSql.match(
      /CREATE\s+POLICY\s+[^;]+\s+ON\s+\w+\s+FOR\s+SELECT[\s\S]*?USING\s*\([\s\S]*?\);/gi
    ) ?? [];

    for (const policy of selectPolicies) {
      const tableMatch = policy.match(/ON\s+(\w+)\s+FOR\s+SELECT/i);
      if (!tableMatch) continue;
      const tableName = tableMatch[1];
      // A SELECT policy on table X should not query table X itself in its USING clause.
      const selfReference = new RegExp(
        `SELECT\\s+\\S+\\s+FROM\\s+${tableName}\\b`,
        "i"
      );
      expect(
        policy,
        `Policy ${policy.slice(0, 60).trim()}... appears to SELECT from its own table (${tableName}) and could recurse`
      ).not.toMatch(selfReference);
    }
  });

  it("every table with a CREATE POLICY statement has ENABLE ROW LEVEL SECURITY", () => {
    // Supabase-managed schemas (e.g. storage.objects) already have RLS enabled by
    // the platform and our Postgres role cannot run ALTER TABLE on them, so skip them.
    const policyTables = Array.from(
      allSql.matchAll(/CREATE\s+POLICY\s+[^\s]+\s+ON\s+((?:\w+\.)?\w+)/gi)
    ).map((m) => m[1]);

    const enabledTables = Array.from(
      allSql.matchAll(/ALTER\s+TABLE\s+((?:\w+\.)?\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi)
    ).map((m) => m[1]);

    const missing = [...new Set(policyTables)]
      .filter((t) => !enabledTables.includes(t))
      .filter((t) => !t.startsWith("storage."));
    expect(missing, `Tables with policies but no ENABLE RLS: ${missing.join(", ")}`).toEqual([]);
  });
});
