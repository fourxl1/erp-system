const {
  buildItemImagePath,
  buildItemImageUrl,
  listUploadedItemImages,
  parseItemImageInput
} = require("../utils/itemImage");

describe("Item image URLs", () => {
  test("builds URLs that match the uploaded item directory", () => {
    expect(buildItemImagePath("part.png")).toBe("/uploads/items/part.png");
  });

  test("builds absolute request URLs for uploaded item images", () => {
    const req = {
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:5000"),
      headers: {}
    };

    expect(buildItemImageUrl(req, "part.png")).toBe("http://localhost:5000/uploads/items/part.png");
  });

  test("accepts previously stored upload URLs when normalizing image input", () => {
    expect(parseItemImageInput("/uploads/items/part.png")).toBe("part.png");
    expect(parseItemImageInput("http://localhost:5000/uploads/items/part.png")).toBe("part.png");
  });

  test("lists existing uploaded item image files", () => {
    expect(Array.isArray(listUploadedItemImages())).toBe(true);
  });
});
