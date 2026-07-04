import { parseImageLine, serializeImage } from "../media/imageBlock";

describe("parseImageLine", () => {
  it("returns null when no image is present", () => {
    expect(parseImageLine("just text")).toBeNull();
    expect(parseImageLine("")).toBeNull();
    expect(parseImageLine("<div>not an image</div>")).toBeNull();
  });

  it("parses a plain markdown image", () => {
    const p = parseImageLine("![alt text](./pic.png)");
    expect(p).not.toBeNull();
    expect(p!.form).toBe("md");
    expect(p!.model.src).toBe("./pic.png");
    expect(p!.model.alt).toBe("alt text");
    expect(p!.model.align).toBe("none");
    expect(p!.model.size).toBe("none");
    expect(p!.startCol).toBe(0);
    expect(p!.endCol).toBe("![alt text](./pic.png)".length);
  });

  it("parses a plain <img> tag", () => {
    const p = parseImageLine('<img src="./pic.png" alt="a">');
    expect(p!.form).toBe("html");
    expect(p!.model.src).toBe("./pic.png");
    expect(p!.model.alt).toBe("a");
    expect(p!.model.align).toBe("none");
    expect(p!.model.size).toBe("none");
  });

  it("recovers align=left from float style", () => {
    const p = parseImageLine('<img src="a.png" alt="" style="float: left; margin: 1em;">');
    expect(p!.model.align).toBe("left");
    expect(p!.model.extraStyles).toEqual({});
  });

  it("recovers align=right from float style", () => {
    const p = parseImageLine('<img src="a.png" style="float:right;margin:1em;">');
    expect(p!.model.align).toBe("right");
  });

  it("recovers align=center from display+margin auto", () => {
    const p = parseImageLine('<img src="a.png" style="display: block; margin: 1em auto;">');
    expect(p!.model.align).toBe("center");
    expect(p!.model.extraStyles).toEqual({});
  });

  it("recovers named size buckets from style width", () => {
    expect(parseImageLine('<img src="a" style="width: 150px;">')!.model.size).toBe("S");
    expect(parseImageLine('<img src="a" style="width: 300px;">')!.model.size).toBe("M");
    expect(parseImageLine('<img src="a" style="width: 500px;">')!.model.size).toBe("L");
    expect(parseImageLine('<img src="a" style="width: 100%;">')!.model.size).toBe("full");
  });

  it("recovers custom width from style", () => {
    const p = parseImageLine('<img src="a" style="width: 220px;">');
    expect(p!.model.size).toBe("custom");
    expect(p!.model.customWidth).toBe("220px");
  });

  it("recovers custom width from the HTML width= attribute", () => {
    const p = parseImageLine('<img src="a" width="200">');
    expect(p!.model.size).toBe("custom");
    expect(p!.model.customWidth).toBe("200px");
  });

  it("preserves unknown attributes and styles", () => {
    const p = parseImageLine(
      '<img src="a" alt="b" class="hero" title="t" style="float: left; margin: 1em; border: 1px solid red;">',
    );
    expect(p!.model.align).toBe("left");
    expect(p!.model.extraAttrs).toEqual({ class: "hero", title: "t" });
    expect(p!.model.extraStyles).toEqual({ border: "1px solid red" });
  });

  it("finds the image even with leading text on the line", () => {
    const p = parseImageLine("Some prefix ![a](b.png) trailing");
    expect(p!.form).toBe("md");
    expect(p!.model.src).toBe("b.png");
    expect(p!.startCol).toBe("Some prefix ".length);
  });

  it("returns the earlier image when both forms are on one line", () => {
    const p = parseImageLine('<img src="a"> and ![b](c.png)');
    expect(p!.form).toBe("html");
    expect(p!.model.src).toBe("a");
  });
});

describe("serializeImage", () => {
  it("emits markdown when there is no layout intent", () => {
    const out = serializeImage({
      src: "./pic.png",
      alt: "alt",
      align: "none",
      size: "none",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe("![alt](./pic.png)");
  });

  it("emits <img> for left-float", () => {
    const out = serializeImage({
      src: "./pic.png",
      alt: "x",
      align: "left",
      size: "none",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="./pic.png" alt="x" style="float: left; margin: 1em;">');
  });

  it("emits <img> for right-float", () => {
    const out = serializeImage({
      src: "./pic.png",
      alt: "",
      align: "right",
      size: "none",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="./pic.png" style="float: right; margin: 1em;">');
  });

  it("emits <img> for center", () => {
    const out = serializeImage({
      src: "./pic.png",
      alt: "",
      align: "center",
      size: "none",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="./pic.png" style="display: block; margin: 1em auto;">');
  });

  it("emits size buckets as width", () => {
    for (const [size, width] of [
      ["S", "150px"],
      ["M", "300px"],
      ["L", "500px"],
      ["full", "100%"],
    ] as const) {
      const out = serializeImage({
        src: "a",
        alt: "",
        align: "none",
        size,
        extraAttrs: {},
        extraStyles: {},
      });
      expect(out).toBe(`<img src="a" style="width: ${width};">`);
    }
  });

  it("emits custom width", () => {
    const out = serializeImage({
      src: "a",
      alt: "",
      align: "none",
      size: "custom",
      customWidth: "220px",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="a" style="width: 220px;">');
  });

  it("emits combined align + size", () => {
    const out = serializeImage({
      src: "a",
      alt: "",
      align: "left",
      size: "M",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="a" style="float: left; margin: 1em; width: 300px;">');
  });

  it("preserves extras", () => {
    const out = serializeImage({
      src: "a",
      alt: "b",
      align: "left",
      size: "none",
      extraAttrs: { class: "hero" },
      extraStyles: { border: "1px solid red" },
    });
    expect(out).toBe('<img src="a" alt="b" style="float: left; margin: 1em; border: 1px solid red;" class="hero">');
  });

  it("escapes quotes in src/alt", () => {
    const out = serializeImage({
      src: 'a"b',
      alt: 'c"d',
      align: "left",
      size: "none",
      extraAttrs: {},
      extraStyles: {},
    });
    expect(out).toBe('<img src="a&quot;b" alt="c&quot;d" style="float: left; margin: 1em;">');
  });
});

describe("round trip", () => {
  const cases = [
    "![alt](./pic.png)",
    '<img src="./pic.png" alt="a" style="float: left; margin: 1em;">',
    '<img src="./pic.png" alt="a" style="float: right; margin: 1em;">',
    '<img src="./pic.png" style="display: block; margin: 1em auto;">',
    '<img src="./pic.png" style="width: 150px;">',
    '<img src="a" style="float: left; margin: 1em; width: 300px;">',
    '<img src="a" alt="b" style="float: left; margin: 1em; border: 1px solid red;" class="hero">',
  ];

  for (const src of cases) {
    it(`preserves: ${src}`, () => {
      const p = parseImageLine(src);
      expect(p).not.toBeNull();
      expect(serializeImage(p!.model)).toBe(src);
    });
  }

  it("normalises the user's freeform tweak into the canonical shape", () => {
    // The demo's user-tweaked form: no `alt` after src, non-canonical
    // spacing, `width="200px"` HTML attr. Serialising should produce a
    // canonical shape while preserving the model.
    const p = parseImageLine('<img src="../image.png" alt="demo" style="float: left;margin:1em;" width="200px">');
    expect(p!.model.align).toBe("left");
    expect(p!.model.size).toBe("custom");
    expect(p!.model.customWidth).toBe("200px");
    expect(serializeImage(p!.model)).toBe(
      '<img src="../image.png" alt="demo" style="float: left; margin: 1em; width: 200px;">',
    );
  });
});
