import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db";
import { feedbackSchema } from "@/lib/validations/feedback";
import { createTestDb } from "./support/d1";

const { products, feedbacks, feedback_images } = schema;

let db: Db;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ db, dispose } = await createTestDb());
});

afterAll(async () => {
  await dispose?.();
});

describe("feedbacks in D1 (migration 0006)", () => {
  it("unlinks a feedback when its product is deleted, and drops images with the feedback", async () => {
    await db.insert(products).values({ id: "p-1", name: "Moletom", slug: "moletom-fb", price: 100 });
    await db.insert(feedbacks).values({ id: "f-1", customer_name: "Carlos Mendes", product_id: "p-1", text: "Ótimo" });
    await db.insert(feedback_images).values([
      { feedback_id: "f-1", url: "/img/feedbacks/a.webp", kind: "photo", position: 0 },
      { feedback_id: "f-1", url: "/img/feedbacks/b.webp", kind: "chat", position: 1 },
    ]);

    await db.delete(products).where(eq(products.id, "p-1"));
    const [row] = await db.select().from(feedbacks).where(eq(feedbacks.id, "f-1"));
    expect(row.product_id).toBeNull();

    await db.delete(feedbacks).where(eq(feedbacks.id, "f-1"));
    expect(await db.select().from(feedback_images).where(eq(feedback_images.feedback_id, "f-1"))).toEqual([]);
  });

  it("refuses a rating outside 1–5 and an unknown image kind", async () => {
    await expect(
      db.insert(feedbacks).values({ customer_name: "X", text: "y", rating: 6 }),
    ).rejects.toThrow();
    await db.insert(feedbacks).values({ id: "f-2", customer_name: "X", text: "y" });
    await expect(
      db.insert(feedback_images).values({ feedback_id: "f-2", url: "/img/feedbacks/c.webp", kind: "video" as "photo" }),
    ).rejects.toThrow();
  });
});

describe("feedbackSchema", () => {
  const base = { customer_name: "Carlos Mendes", show_on_home: true, active: true };

  it("needs a text or at least one image", () => {
    expect(feedbackSchema.safeParse({ ...base, text: "", images: [] }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, text: "Gostei", images: [] }).success).toBe(true);
    expect(
      feedbackSchema.safeParse({ ...base, text: "", images: [{ url: "/img/feedbacks/00000000-0000-4000-a000-000000000000.webp", kind: "chat" }] }).success,
    ).toBe(true);
  });

  it("takes up to 10 images", () => {
    const images = Array.from({ length: 11 }, (_, i) => ({
      url: `/img/feedbacks/00000000-0000-4000-a000-0000000000${String(i).padStart(2, "0")}.webp`,
      kind: "photo",
    }));
    expect(feedbackSchema.safeParse({ ...base, images }).success).toBe(false);
    expect(feedbackSchema.safeParse({ ...base, images: images.slice(0, 10) }).success).toBe(true);
  });

  it("reads empty optional fields as not set", () => {
    const parsed = feedbackSchema.parse({ ...base, text: "Ok", rating: "", position: "", product_id: "", feedback_date: "" });
    expect(parsed).toMatchObject({ rating: null, position: null, product_id: null, feedback_date: null });
  });
});
