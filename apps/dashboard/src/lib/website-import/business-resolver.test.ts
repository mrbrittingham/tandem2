import assert from "node:assert/strict";
import test from "node:test";
import { resolveBusinessId } from "./business-resolver";

test("resolveBusinessId resolves slug input to business text id", async () => {
  const fakeSupabase = {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              return {
                limit() {
                  return {
                    async returns() {
                      if (table === "businesses" && column === "slug" && value === "cedar-sage") {
                        return {
                          data: [{ id: "cedar-sage", slug: "cedar-sage" }],
                          error: null,
                        };
                      }
                      return { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const resolved = await resolveBusinessId({
    supabase: fakeSupabase as never,
    businessSlug: "cedar-sage",
    businessId: "",
  });

  assert.equal(resolved.businessId, "cedar-sage");
  assert.equal(resolved.businessSlug, "cedar-sage");
  assert.equal(resolved.inputMode, "slug");
});

test("resolveBusinessId accepts opaque text businessId when no business row exists", async () => {
  const fakeSupabase = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                limit() {
                  return {
                    async returns() {
                      return { data: [], error: null };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const resolved = await resolveBusinessId({
    supabase: fakeSupabase as never,
    businessId: "cedar-sage",
    businessSlug: "",
  });

  assert.equal(resolved.businessId, "cedar-sage");
  assert.equal(resolved.businessSlug, null);
  assert.equal(resolved.inputMode, "id");
});
