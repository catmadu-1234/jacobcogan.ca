import { describe, expect, it } from "vitest";
import { ApiError } from "../../src/app/lib/api";
import { saveErrorMessage } from "../../src/app/lib/saveErrorMessage";

describe("saveErrorMessage", () => {
  it("names the field the server rejected", () => {
    const err = new ApiError(400, { error: "invalid", issues: [{ path: "title", message: "Too long" }] });
    expect(saveErrorMessage(err)).toContain('"title"');
  });

  it("blames the server, not the user, for 5xx", () => {
    expect(saveErrorMessage(new ApiError(500, { error: "server" }))).toContain("Not you");
  });

  it("says the server couldn't be reached for network failures", () => {
    expect(saveErrorMessage(new TypeError("Failed to fetch"))).toContain("reach the server");
  });
});
