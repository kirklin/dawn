import { describe, expect, it } from "vitest";
import { placeHref, placeKey, placePages, roundPlace } from "../store";

const guangzhou = { name: "广州", detail: "广东 广州市", lat: 23.116_667, lon: 113.25 };
const beijing = { name: "北京", detail: "北京市", lat: 39.907_5, lon: 116.397_2 };

describe("place helpers", () => {
  it("keeps the precision place links carry", () => {
    expect(roundPlace(guangzhou)).toEqual({ ...guangzhou, lat: 23.1167, lon: 113.25 });
    expect(placeKey(roundPlace(guangzhou))).toBe(placeKey(guangzhou));
  });

  it("encodes a place and its page flags into the link", () => {
    const url = new URL(placeHref(guangzhou, { preview: true }), "https://example.com");
    expect(url.pathname).toBe("/place");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      lat: "23.1167",
      lon: "113.2500",
      name: "广州",
      detail: "广东 广州市",
      preview: "1",
    });
    expect(new URL(placeHref({ ...beijing, detail: "" }, { current: true }), "https://example.com").searchParams.has("detail")).toBe(false);
  });

  it("pages through my location first, then the saved places", () => {
    const here = { ...beijing, name: "东城区" };
    expect(placePages([guangzhou, beijing], { enabled: true, last: here })).toEqual([
      { place: here, current: true },
      { place: guangzhou, current: false },
      { place: beijing, current: false },
    ]);
    expect(placePages([guangzhou], { enabled: false, last: null })).toEqual([{ place: guangzhou, current: false }]);
  });
});
