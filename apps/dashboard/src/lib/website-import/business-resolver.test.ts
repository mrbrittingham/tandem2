import assert from "node:assert/strict";
import test from "node:test";
import { isUuid, resolveBusinessId } from "./business-resolver";

test("isUuid detects canonical uuid strings", () => {
  assert.equal(isUuid("9b60514e-df53-4f7b-b8ad-49d2f3599500"), true);
  assert.equal(isUuid("cedar-sage"), false);
});

test("resolveBusinessId resolves slug input to business uuid", async () => {
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
                          data: [{ id: "9b60514e-df53-4f7b-b8ad-49d2f3599500", slug: "cedar-sage" }],
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

  assert.equal(resolved.businessId, "9b60514e-df53-4f7b-b8ad-49d2f3599500");
  assert.equal(resolved.businessSlug, "cedar-sage");
  assert.equal(resolved.inputMode, "slug");
});
