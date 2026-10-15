import type { SavedPlace } from "./store";

/**
 * Offered in the place search before anything is typed. Each sits at the point the search returns for the
 * city, Open-Meteo's GeoNames seat, to the four decimals place links carry, so adding it from either gives
 * the same place.
 */
export const HOT_CITIES: SavedPlace[] = [
  { name: "北京", detail: "北京市", lat: 39.9075, lon: 116.3972 },
  { name: "上海", detail: "上海市", lat: 31.2222, lon: 121.4581 },
  { name: "广州", detail: "广东 广州市", lat: 23.1167, lon: 113.25 },
  { name: "深圳", detail: "广东", lat: 22.5455, lon: 114.0683 },
  { name: "杭州", detail: "浙江 杭州市", lat: 30.2937, lon: 120.1614 },
  { name: "南京", detail: "江苏", lat: 32.0617, lon: 118.7778 },
  { name: "苏州", detail: "江苏 苏州市", lat: 31.3041, lon: 120.5954 },
  { name: "成都", detail: "四川 成都市", lat: 30.6667, lon: 104.0667 },
  { name: "重庆", detail: "重庆市", lat: 29.5603, lon: 106.5577 },
  { name: "武汉", detail: "湖北 武汉市", lat: 30.5833, lon: 114.2667 },
  { name: "西安", detail: "陕西 西安市", lat: 34.2583, lon: 108.9286 },
  { name: "天津", detail: "天津市", lat: 39.1422, lon: 117.1767 },
  { name: "长沙", detail: "湖南 长沙市", lat: 28.1987, lon: 112.9709 },
  { name: "厦门", detail: "福建省", lat: 24.4798, lon: 118.0819 },
  { name: "青岛", detail: "山东 青岛市", lat: 36.0649, lon: 120.3804 },
  { name: "三亚", detail: "海南 三亚市", lat: 18.2544, lon: 109.5095 },
];
