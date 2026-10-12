import { describe, expect, it } from "vitest";
import { placeFromGeocoding } from "../geocode";

// The `geocoding` objects below are what Nominatim answered for these points on 2026-10-13.
describe("placeFromGeocoding", () => {
  it("names a Chinese point by its city, with the province as detail", () => {
    expect(placeFromGeocoding({ name: "北京街道", city: "广州市", state: "广东省", country: "中国", country_code: "cn" }))
      .toEqual({ name: "广州市", detail: "广东省" });
    expect(placeFromGeocoding({ name: "满江街道", city: "大理市", county: "大理白族自治州", state: "云南省", country: "中国", country_code: "cn" }))
      .toEqual({ name: "大理市", detail: "云南省 大理白族自治州" });
  });

  it("falls to the county outside cities", () => {
    expect(placeFromGeocoding({ name: "罗布泊镇", county: "若羌县", state: "新疆维吾尔自治区", country: "中国", country_code: "cn" }))
      .toEqual({ name: "若羌县", detail: "新疆维吾尔自治区" });
  });

  it("keeps the main variant of a name and puts the country first abroad", () => {
    expect(placeFromGeocoding({ name: "Manhattan", city: "纽约;紐約", state: "纽约州;紐約州", country: "美国;美國", country_code: "us" }))
      .toEqual({ name: "纽约", detail: "美国 纽约州" });
  });

  it("leaves out a division with the same name as the place", () => {
    expect(placeFromGeocoding({ name: "中西区", city: "香港", state: "香港", country: "中国", country_code: "cn" }))
      .toEqual({ name: "香港", detail: "" });
  });

  it("finds no place when nothing is named", () => {
    expect(placeFromGeocoding({})).toBeNull();
  });
});
