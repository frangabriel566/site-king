import { describe, expect, it } from "vitest";
import {
  isImageKey,
  keyFromImageUrl,
  storeLogoIconUrls,
  storedKeysFor,
  uploadKeyFor,
  uploadKeysIn,
} from "@/lib/image-url";

const LOGO = "brand/0f8fad5b-d9cb-469f-a165-70867728950e.png";
const PHOTO = "products/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp";

describe("store logo icons", () => {
  it("derives the icons from a logo uploaded as PNG in brand/", () => {
    expect(storeLogoIconUrls(`/img/${LOGO}`)).toEqual({
      icon: "/img/brand/0f8fad5b-d9cb-469f-a165-70867728950e.icon.png",
      favicon: "/img/brand/0f8fad5b-d9cb-469f-a165-70867728950e.favicon.png",
    });
  });

  it("has none for a WebP logo, a photo, an external URL or no logo", () => {
    expect(storeLogoIconUrls("/img/brand/0f8fad5b-d9cb-469f-a165-70867728950e.webp")).toBeNull();
    expect(storeLogoIconUrls(`/img/${PHOTO}`)).toBeNull();
    expect(storeLogoIconUrls("https://picsum.photos/200")).toBeNull();
    expect(storeLogoIconUrls(null)).toBeNull();
  });

  it("serves the icon keys through /img", () => {
    const icons = storeLogoIconUrls(`/img/${LOGO}`)!;
    expect(keyFromImageUrl(icons.icon)).not.toBeNull();
    expect(keyFromImageUrl(icons.favicon)).not.toBeNull();
    expect(isImageKey("brand/0f8fad5b-d9cb-469f-a165-70867728950e.other.png")).toBe(false);
  });
});

describe("storedKeysFor", () => {
  it("lists a photo and its thumbnail", () => {
    expect(storedKeysFor(PHOTO)).toEqual([
      PHOTO,
      "products/7c9e6679-7425-40de-944b-e07fc1f90ae7.sm.webp",
    ]);
  });

  it("lists the logo, its thumbnail and both icons", () => {
    expect(storedKeysFor(LOGO)).toEqual([
      LOGO,
      "brand/0f8fad5b-d9cb-469f-a165-70867728950e.sm.png",
      "brand/0f8fad5b-d9cb-469f-a165-70867728950e.icon.png",
      "brand/0f8fad5b-d9cb-469f-a165-70867728950e.favicon.png",
    ]);
  });
});

describe("which upload a stored file or a saved URL belongs to", () => {
  it("maps thumbnails and logo icons back to the upload", () => {
    expect(uploadKeyFor("products/7c9e6679-7425-40de-944b-e07fc1f90ae7.sm.webp")).toBe(PHOTO);
    expect(uploadKeyFor("brand/0f8fad5b-d9cb-469f-a165-70867728950e.favicon.png")).toBe(LOGO);
    expect(uploadKeyFor(PHOTO)).toBe(PHOTO);
  });

  it("finds uploads in relative, absolute and query-string URLs, and nothing else", () => {
    expect(uploadKeysIn(`/img/${PHOTO}`)).toEqual([PHOTO]);
    expect(uploadKeysIn(`https://sitekingstore.com.br/img/${PHOTO}?v=sm`)).toEqual([PHOTO]);
    expect(uploadKeysIn("https://picsum.photos/seed/x/800/800")).toEqual([]);
    expect(uploadKeysIn("/img/outra/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp")).toEqual([]);
  });
});
