from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
from PIL import Image
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "pfe"
SHOT_DIR = OUT_DIR / "screenshots-full"
OUT = OUT_DIR / "presentation-pfe-focal-assist-v3-luxury.pptx"
LOGO = ROOT / "tmp_template_image1.png"

SLIDE_W = 12192000
SLIDE_H = 6858000
PX_W = 960
PX_H = 540


def emu_x(x: float) -> int:
    return round(x / PX_W * SLIDE_W)


def emu_y(y: float) -> int:
    return round(y / PX_H * SLIDE_H)


def wh(w: float, h: float) -> tuple[int, int]:
    return emu_x(w), emu_y(h)


def hx(color: str) -> str:
    return color.replace("#", "").upper()


C = {
    "navy": "091430",
    "ink": "1E293B",
    "muted": "64748B",
    "blue": "2E63EB",
    "cyan": "00A7A5",
    "green": "16A34A",
    "orange": "EA580C",
    "red": "DC2626",
    "bg": "F7FAFF",
    "white": "FFFFFF",
    "border": "C8D8EA",
    "soft_blue": "E8F0FF",
    "soft_cyan": "E4FAF7",
    "dark_panel": "111827",
}


def solid(color: str, alpha: int | None = None) -> str:
    a = f"<a:alpha val=\"{alpha}\"/>" if alpha is not None else ""
    return f"<a:solidFill><a:srgbClr val=\"{hx(color)}\">{a}</a:srgbClr></a:solidFill>"


def line(color: str = "FFFFFF", width: int = 9525, alpha: int | None = None) -> str:
    a = f"<a:alpha val=\"{alpha}\"/>" if alpha is not None else ""
    return (
        f"<a:ln w=\"{width}\"><a:solidFill><a:srgbClr val=\"{hx(color)}\">"
        f"{a}</a:srgbClr></a:solidFill></a:ln>"
    )


@dataclass
class Relationship:
    rid: str
    target: str
    rel_type: str = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"


@dataclass
class Slide:
    number: int
    section: str
    title: str = ""
    parts: list[str] = field(default_factory=list)
    rels: list[Relationship] = field(default_factory=list)
    next_id: int = 2

    def sid(self) -> int:
        value = self.next_id
        self.next_id += 1
        return value

    def rect(
        self,
        x: float,
        y: float,
        w: float,
        h: float,
        fill: str,
        outline: str | None = None,
        radius: str = "roundRect",
        alpha: int | None = None,
    ) -> None:
        sid = self.sid()
        cx, cy = wh(w, h)
        outline_xml = line(outline, 8000) if outline else '<a:ln><a:noFill/></a:ln>'
        self.parts.append(
            f"""
            <p:sp>
              <p:nvSpPr><p:cNvPr id="{sid}" name="Shape {sid}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
              <p:spPr>
                <a:xfrm><a:off x="{emu_x(x)}" y="{emu_y(y)}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
                <a:prstGeom prst="{radius}"><a:avLst/></a:prstGeom>
                {solid(fill, alpha)}
                {outline_xml}
              </p:spPr>
            </p:sp>
            """
        )

    def text(
        self,
        text: str,
        x: float,
        y: float,
        w: float,
        h: float,
        size: int = 16,
        color: str = C["ink"],
        bold: bool = False,
        align: str = "l",
        fill: str | None = None,
    ) -> None:
        sid = self.sid()
        cx, cy = wh(w, h)
        fill_xml = solid(fill) if fill else "<a:noFill/>"
        paras = []
        for line_text in str(text).split("\n"):
            line_text = line_text if line_text else " "
            paras.append(
                f"""
                <a:p>
                  <a:pPr algn="{align}"/>
                  <a:r>
                    <a:rPr lang="fr-FR" sz="{size * 100}" b="{1 if bold else 0}">
                      {solid(color)}
                      <a:latin typeface="Arial"/>
                    </a:rPr>
                    <a:t>{escape(line_text)}</a:t>
                  </a:r>
                </a:p>
                """
            )
        self.parts.append(
            f"""
            <p:sp>
              <p:nvSpPr><p:cNvPr id="{sid}" name="Text {sid}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
              <p:spPr>
                <a:xfrm><a:off x="{emu_x(x)}" y="{emu_y(y)}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                {fill_xml}<a:ln><a:noFill/></a:ln>
              </p:spPr>
              <p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>
                {''.join(paras)}
              </p:txBody>
            </p:sp>
            """
        )

    def picture(self, image_path: Path, x: float, y: float, w: float, h: float, media_name: str, rid: str) -> None:
        if not image_path.exists():
            return
        sid = self.sid()
        cx, cy = wh(w, h)
        self.rels.append(Relationship(rid, f"../media/{media_name}"))
        self.parts.append(
            f"""
            <p:pic>
              <p:nvPicPr><p:cNvPr id="{sid}" name="{escape(media_name)}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
              <p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
              <p:spPr><a:xfrm><a:off x="{emu_x(x)}" y="{emu_y(y)}"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>
                <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
              </p:spPr>
            </p:pic>
            """
        )

    def line_rect(self, x: float, y: float, w: float, h: float, color: str, alpha: int | None = None) -> None:
        self.rect(x, y, w, h, color, None, "rect", alpha)

    def background(self) -> None:
        self.rect(0, 0, PX_W, PX_H, C["bg"], None, "rect")
        self.rect(690, 18, 310, 310, C["soft_cyan"], None, "ellipse", 45000)
        self.rect(-110, 118, 310, 310, C["soft_blue"], None, "ellipse", 52000)
        for gx in range(0, PX_W + 1, 80):
            self.line_rect(gx, 48, 0.8, PX_H - 48, "D8E6F5", 65000)
        for gy in range(48, PX_H + 1, 64):
            self.line_rect(0, gy, PX_W, 0.8, "D8E6F5", 70000)
        self.rect(0, 0, PX_W, 48, C["navy"], None, "rect")
        self.line_rect(0, 46.5, PX_W, 2, C["cyan"])
        self.rect(24, 13, 24, 24, C["blue"], C["cyan"], "roundRect")
        self.text("KA", 29, 18, 18, 10, 8, C["white"], True)
        self.text("Focal V3", 58, 12, 145, 14, 10, C["white"], True)
        self.text("PFE | ISMAGI", 58, 27, 120, 10, 7, "B0DCEB")
        self.text(self.section, 700, 14, 170, 14, 9, "B0DCEB")
        self.text(f"{self.number:02}", 902, 13, 34, 18, 10, C["white"], True)

    def add_title(self, title: str, subtitle: str = "") -> None:
        self.text(title, 54, 68, 850, 42, 27, C["navy"], True)
        self.line_rect(54, 120, 104, 4, C["cyan"])
        self.line_rect(164, 120, 38, 4, C["blue"])
        if subtitle:
            self.text(subtitle, 54, 136, 820, 31, 13, C["muted"])

    def bullets(self, items: list[str], x: float, y: float, w: float, h: float, size: int = 15) -> None:
        self.text("\n".join(f"• {item}" for item in items), x, y, w, h, size, C["ink"])

    def stat(self, value: str, label: str, x: float, y: float, accent: str = C["blue"]) -> None:
        self.rect(x, y, 190, 92, C["white"], C["border"])
        self.line_rect(x, y, 190, 5, accent)
        self.text(value, x + 18, y + 14, 150, 28, 23, accent, True)
        self.text(label, x + 18, y + 50, 150, 30, 10, C["muted"])

    def flow(self, steps: list[str], x: float, y: float, w: float, fill: str = C["white"]) -> None:
        gap = 28
        box_w = (w - (len(steps) - 1) * gap) / len(steps)
        for i, step in enumerate(steps):
            bx = x + i * (box_w + gap)
            accent = C["blue"] if i % 2 == 0 else C["cyan"]
            self.rect(bx, y, box_w, 76, fill, C["border"])
            self.line_rect(bx, y, box_w, 5, accent)
            self.rect(bx + 10, y + 18, 22, 22, C["navy"], C["cyan"], "ellipse")
            self.text(str(i + 1), bx + 16, y + 23, 10, 9, 7, C["white"], True)
            self.text(step, bx + 40, y + 20, box_w - 50, 34, 11, C["navy"], True)
            if i < len(steps) - 1:
                self.line_rect(bx + box_w + 4, y + 38, gap - 7, 3, C["cyan"])
                self.rect(bx + box_w + gap - 8, y + 34.5, 8, 8, C["cyan"], None, "ellipse")

    def screenshot(self, path: Path, x: float, y: float, w: float, h: float, media_name: str, rid: str) -> None:
        self.rect(x, y, w, h, C["navy"], C["border"])
        self.rect(x + 8, y + 8, w - 16, 26, C["dark_panel"], None, "rect")
        self.rect(x + 20, y + 17, 7, 7, C["red"], None, "ellipse")
        self.rect(x + 34, y + 17, 7, 7, "F59E0B", None, "ellipse")
        self.rect(x + 48, y + 17, 7, 7, "22C55E", None, "ellipse")
        self.rect(x + 70, y + 14, max(80, w - 110), 14, "1E293B", None)
        px, py, pw, ph = fit_image(path, x + 8, y + 40, w - 16, h - 48)
        self.picture(path, px, py, pw, ph, media_name, rid)

    def class_box(self, name: str, attrs: list[str], x: float, y: float, w: float = 188, h: float = 98, accent: str = C["blue"]) -> None:
        self.rect(x, y, w, h, C["white"], C["border"])
        self.rect(x, y, w, 28, C["navy"], None, "rect")
        self.line_rect(x, y, 5, h, accent)
        self.text("ENTITY", x + 10, y + 5, 44, 8, 5, "B0DCEB")
        self.text(name, x + 56, y + 6, w - 64, 13, 8, C["white"], True)
        self.line_rect(x + 12, y + 34, w - 24, 0.8, "E2ECF7")
        self.text("\n".join(f"+ {a}" for a in attrs), x + 14, y + 42, w - 24, h - 48, 7, C["ink"])

    def xml(self) -> str:
        return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    {''.join(self.parts)}
  </p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>"""

    def rels_xml(self) -> str:
        items = [
            '<Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>'
        ]
        for r in self.rels:
            items.append(f'<Relationship Id="{r.rid}" Type="{r.rel_type}" Target="{r.target}"/>')
        return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(items)}</Relationships>"""


def fit_image(path: Path, x: float, y: float, w: float, h: float) -> tuple[float, float, float, float]:
    if not path.exists():
        return x, y, w, h
    with Image.open(path) as img:
        aspect = img.width / img.height
    box_aspect = w / h
    if aspect > box_aspect:
        draw_w = w
        draw_h = w / aspect
    else:
        draw_h = h
        draw_w = h * aspect
    return x + (w - draw_w) / 2, y + (h - draw_h) / 2, draw_w, draw_h


class Deck:
    def __init__(self):
        self.slides: list[Slide] = []
        self.media: dict[Path, str] = {}

    def media_name(self, path: Path) -> str:
        path = path.resolve()
        if path not in self.media:
            suffix = path.suffix.lower() or ".png"
            self.media[path] = f"image{len(self.media) + 1}{suffix}"
        return self.media[path]

    def add_slide(self, section: str) -> Slide:
        s = Slide(len(self.slides) + 1, section)
        s.background()
        self.slides.append(s)
        return s

    def save(self, out: Path) -> None:
        out.parent.mkdir(parents=True, exist_ok=True)
        if out.exists():
            out.unlink()
        with ZipFile(out, "w", ZIP_DEFLATED) as z:
            write_package(z, self.slides, self.media)


def add_picture(slide: Slide, deck: Deck, image: Path, x: float, y: float, w: float, h: float, rid: str) -> None:
    slide.picture(image, x, y, w, h, deck.media_name(image), rid)


def add_screenshot(slide: Slide, deck: Deck, image: Path, x: float, y: float, w: float, h: float, rid: str) -> None:
    slide.screenshot(image, x, y, w, h, deck.media_name(image), rid)


def content_types(slide_count: int) -> str:
    overrides = [
        '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
        '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
        '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
        '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    ]
    for i in range(1, slide_count + 1):
        overrides.append(f'<Override PartName="/ppt/slides/slide{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>')
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  {''.join(overrides)}
</Types>"""


def presentation_xml(slide_count: int) -> str:
    slide_ids = "".join(
        f'<p:sldId id="{255 + i}" r:id="rId{i}"/>' for i in range(1, slide_count + 1)
    )
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rIdMaster"/></p:sldMasterIdLst>
  <p:sldIdLst>{slide_ids}</p:sldIdLst>
  <p:sldSz cx="{SLIDE_W}" cy="{SLIDE_H}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
  <p:defaultTextStyle/>
</p:presentation>"""


def presentation_rels(slide_count: int) -> str:
    rels = [
        '<Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
    ]
    for i in range(1, slide_count + 1):
        rels.append(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide{i}.xml"/>')
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{''.join(rels)}</Relationships>"""


def master_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
 <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
 <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
 <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rIdLayout"/></p:sldLayoutIdLst>
 <p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>
</p:sldMaster>"""


def layout_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
 xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
 <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
 <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>"""


def theme_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Focal Luxury">
 <a:themeElements>
  <a:clrScheme name="Focal">
   <a:dk1><a:srgbClr val="091430"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
   <a:dk2><a:srgbClr val="1E293B"/></a:dk2><a:lt2><a:srgbClr val="F7FAFF"/></a:lt2>
   <a:accent1><a:srgbClr val="2E63EB"/></a:accent1><a:accent2><a:srgbClr val="00A7A5"/></a:accent2>
   <a:accent3><a:srgbClr val="16A34A"/></a:accent3><a:accent4><a:srgbClr val="EA580C"/></a:accent4>
   <a:accent5><a:srgbClr val="64748B"/></a:accent5><a:accent6><a:srgbClr val="C8D8EA"/></a:accent6>
   <a:hlink><a:srgbClr val="2E63EB"/></a:hlink><a:folHlink><a:srgbClr val="00A7A5"/></a:folHlink>
  </a:clrScheme>
  <a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
  <a:fmtScheme name="focal"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
 </a:themeElements>
</a:theme>"""


def write_package(z: ZipFile, slides: list[Slide], media: dict[Path, str]) -> None:
    z.writestr("[Content_Types].xml", content_types(len(slides)))
    z.writestr("_rels/.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>""")
    z.writestr("docProps/core.xml", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Focal V3 - PFE Luxury Presentation</dc:title><dc:creator>Abdelfattah AZELMADI</dc:creator><cp:lastModifiedBy>Codex</cp:lastModifiedBy></cp:coreProperties>""")
    z.writestr("docProps/app.xml", f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Microsoft PowerPoint</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>{len(slides)}</Slides></Properties>""")
    z.writestr("ppt/presentation.xml", presentation_xml(len(slides)))
    z.writestr("ppt/_rels/presentation.xml.rels", presentation_rels(len(slides)))
    z.writestr("ppt/slideMasters/slideMaster1.xml", master_xml())
    z.writestr("ppt/slideMasters/_rels/slideMaster1.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdLayout" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>""")
    z.writestr("ppt/slideLayouts/slideLayout1.xml", layout_xml())
    z.writestr("ppt/slideLayouts/_rels/slideLayout1.xml.rels", """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMaster" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>""")
    z.writestr("ppt/theme/theme1.xml", theme_xml())
    for i, slide in enumerate(slides, start=1):
        z.writestr(f"ppt/slides/slide{i}.xml", slide.xml())
        z.writestr(f"ppt/slides/_rels/slide{i}.xml.rels", slide.rels_xml())
    for path, name in media.items():
        z.write(path, f"ppt/media/{name}")


def class_slide(deck: Deck, title: str, boxes: list[tuple[str, list[str], float, float, float, float, str]]) -> None:
    s = deck.add_slide("Diagrammes techniques")
    s.add_title(title, "Vue UML simplifiee avec classes principales, attributs et relations metier.")
    for name, attrs, x, y, w, h, color in boxes:
        s.class_box(name, attrs, x, y, w, h, color)


def screenshot_slide(deck: Deck, title: str, file_name: str, notes: list[str]) -> None:
    s = deck.add_slide("Demonstration V3")
    s.add_title(title, "Capture reelle de l'application locale V3.")
    add_screenshot(s, deck, SHOT_DIR / file_name, 50, 135, 620, 350, "rIdImg1")
    s.rect(700, 145, 205, 320, C["white"], C["border"])
    s.text("Points a presenter", 720, 166, 160, 22, 15, C["blue"], True)
    s.bullets(notes, 720, 205, 160, 230, 11)


def build_deck() -> Deck:
    d = Deck()

    s = d.add_slide("Page de garde")
    s.rect(38, 34, 465, 395, C["white"], C["border"])
    if LOGO.exists():
        add_picture(s, d, LOGO, 54, 42, 180, 70, "rIdLogo")
    s.text("Projet de Fin d'Etudes", 54, 128, 420, 24, 15, C["cyan"], True)
    s.text("Focal V3", 54, 162, 420, 44, 34, C["navy"], True)
    s.text("Plateforme omnicanale d'assistance operationnelle et de gestion des connaissances", 54, 212, 480, 74, 21, C["ink"], True)
    s.text("Cycle d'ingenieur | ISMAGI | 2025 - 2026", 54, 306, 420, 22, 13, C["muted"])
    s.text("Realise par : Abdelfattah AZELMADI", 54, 344, 390, 24, 15, C["navy"], True)
    add_screenshot(s, d, SHOT_DIR / "02-command-center.png", 520, 78, 360, 230, "rIdHero")
    s.rect(520, 330, 360, 110, C["white"], C["border"])
    s.text("Objectif de soutenance", 542, 354, 310, 20, 15, C["blue"], True)
    s.text("Demontrer une solution full stack riche, modulaire, securisee et adaptee aux operations d'une fintech.", 542, 384, 300, 44, 13, C["ink"])

    intro = [
        ("Sommaire detaille", ["Contexte, problematique, objectifs et cahier des charges.", "Solution proposee, stack technique et conception UX/UI.", "Diagrammes : cas d'utilisation, classes, sequences, donnees, architecture.", "Implementation : frontend, backend, APIs, securite, integrabilite.", "Demonstration : une slide par page V3 avec capture reelle.", "Difficultes, resultats, limites, perspectives, conclusion."]),
        ("Contexte du projet", ["Les fintechs doivent traiter vite, juste et de maniere tracable.", "Les agents dependent de procedures fiables et d'une information a jour.", "Les superviseurs ont besoin de donnees exploitables sur activite et qualite.", "Les outils disperses ralentissent les operations et augmentent les erreurs."]),
        ("Problematique", ["Comment centraliser les operations de support sans sacrifier la qualite ?", "Comment guider les agents dans des processus sensibles ?", "Comment mesurer l'usage de la connaissance et la performance ?", "Comment securiser les acces selon les roles et les responsabilites ?"]),
        ("Objectifs", ["Centraliser CRM, KB, Magic Assistance, QA, formations, collaboration et escalade.", "Permettre aux agents de repondre plus vite avec des procedures fiables.", "Donner aux superviseurs des analytics exploitables par agent et article.", "Gerer les droits et roles sans modification du code.", "Integrer live chat, Gmail, Jira et IA de maniere controlee."]),
    ]
    for title, bullets in intro:
        s = d.add_slide("Introduction")
        s.add_title(title, "Synthese du contexte et des objectifs du PFE.")
        if title == "Contexte du projet":
            s.stat("Support", "Demandes clients multi-sujets", 78, 165, C["blue"])
            s.stat("Knowledge", "Procedures et articles critiques", 290, 165, C["cyan"])
            s.stat("Quality", "QA et supervision", 502, 165, C["green"])
            s.stat("AI", "Assistance agent controlee", 714, 165, C["orange"])
            s.bullets(bullets, 100, 305, 760, 108, 17)
        else:
            s.bullets(bullets, 82, 165, 805, 235, 18)

    s = d.add_slide("Analyse")
    s.add_title("Analyse des besoins", "Les acteurs ont des besoins differents mais un meme environnement de travail.")
    s.flow(["Agent", "Team Leader", "QA", "Admin", "OPS"], 70, 155, 820)
    s.bullets(["Agent : CRM, KB, Magic Assistance, formations, chat assigne.", "Team Leader : equipe, adherence, tickets, performance.", "QA : evaluation des interactions et feedbacks.", "Admin : comptes, acces, builders, configurations, integrations.", "OPS/Head of CS : supervision globale, analytics, amelioration continue."], 92, 278, 770, 140, 17)

    s = d.add_slide("Cahier des charges")
    s.add_title("Cahier des charges", "Exigences fonctionnelles et non fonctionnelles prioritaires.")
    s.rect(58, 150, 410, 278, C["white"], C["border"])
    s.text("Fonctionnel", 84, 174, 260, 22, 20, C["blue"], True)
    s.bullets(["Authentification et roles", "CRM email et tickets", "Knowledge Base et SOP maps", "Magic Assistance", "Collaboration et Live Chat", "Academy, QA, adherence", "Escalade L1/L2 et Jira"], 84, 214, 330, 170, 14)
    s.rect(500, 150, 410, 278, C["white"], C["border"])
    s.text("Non fonctionnel", 526, 174, 260, 22, 20, C["cyan"], True)
    s.bullets(["Securite JWT", "Controle serveur des acces", "WebSocket temps reel", "Base relationnelle", "Dockerisation", "Modularite Angular/Spring", "Extensibilite IA et canaux"], 526, 214, 330, 170, 14)

    s = d.add_slide("Etat de l'existant")
    s.add_title("Etude de l'existant", "Positionnement par rapport aux outils du marche.")
    s.bullets(["Zendesk : tres complet pour support, mais personnalisation avancee couteuse.", "Helpjuice : excellent pour la knowledge base, moins centre operations internes.", "Slack : puissant en collaboration, mais pas lie nativement aux SOP, QA et tickets.", "Jira : tres adapte aux equipes techniques, moins naturel pour les agents L1.", "Focal V3 : support + knowledge + process + QA + AI + escalation dans un meme cockpit."], 82, 155, 820, 215, 18)

    s = d.add_slide("Solution")
    s.add_title("Solution proposee", "Un cockpit operationnel V3 autour des processus de support.")
    s.bullets(["Un shell unique pour tous les modules.", "Navigation par sections : Workspace, Academy, Build, Manage, Delivery.", "Acces conditionnels par role et par fonctionnalite.", "Builders visuels pour adapter les processus sans redeployer.", "Mesure d'usage et feedback pour amelioration continue."], 72, 160, 385, 190, 16)
    add_screenshot(s, d, SHOT_DIR / "02-command-center.png", 510, 140, 370, 250, "rIdImg1")

    s = d.add_slide("Technologies")
    s.add_title("Technologies utilisees", "Stack moderne, lisible et deployable.")
    s.flow(["Angular 21", "Spring Boot 4", "REST APIs", "WebSocket", "MySQL", "Docker"], 42, 158, 875)
    s.bullets(["Angular : composants standalone, lazy loading, services HTTP, routing V3.", "Spring Boot : controllers, services, repositories, security, websocket.", "MySQL/MariaDB : donnees metier, logs, historiques, relations.", "Integrations : Gmail OAuth, Jira REST, OpenAI, chat public.", "DevOps : Dockerfiles frontend/backend, Docker Compose, guide Oracle Cloud."], 86, 290, 790, 132, 16)

    s = d.add_slide("Conception")
    s.add_title("Conception UX/UI", "V3 reprend une logique SaaS propre, lisible et orientee action.")
    s.bullets(["Sidebar constante pour garder les reperes.", "Topbar globale pour recherche, langue, timezone et statut.", "Maps : canvas, cartes, connecteurs, inspecteurs, zoom et pan.", "Animations appliquees au contenu, pas aux barres de navigation.", "Direction graphique : bleu confiance, turquoise technique, espaces aeres."], 70, 155, 390, 210, 16)
    add_screenshot(s, d, SHOT_DIR / "27-role-access-map.png", 520, 135, 360, 270, "rIdImg1")

    s = d.add_slide("Diagrammes")
    s.add_title("Diagramme de cas d'utilisation - Vue globale", "Les cas d'utilisation sont regroupes par famille d'acteurs.")
    s.flow(["Client public", "Agent", "Supervisor", "Admin"], 80, 155, 800, C["soft_blue"])
    s.bullets(["Client public : demarrer chat, suivre workflow, escalader, donner CSAT.", "Agent : traiter CRM, consulter KB, utiliser Magic Assistance, suivre formations.", "Supervisor : consulter QA, adherence, KB analytics, tickets equipe.", "Admin : creer comptes, gerer acces, builders, articles, prompts, projets chat."], 90, 285, 780, 135, 17)

    s = d.add_slide("Diagrammes")
    s.add_title("Diagramme de cas d'utilisation - Detail", "Relation entre modules et objectifs metier.")
    for x, title, color, bullets in [
        (52, "Agent", C["blue"], ["Repondre email", "Ajouter note interne", "Choisir tag", "Consulter SOP", "Demander aide IA"]),
        (354, "Supervision", C["cyan"], ["Evaluer QA", "Suivre temps article", "Voir adherence", "Analyser tickets", "Piloter equipe"]),
        (656, "Administration", C["green"], ["Gerer roles", "Creer articles", "Construire maps", "Configurer prompts", "Gerer users"]),
    ]:
        s.rect(x, 150, 250, 250, C["white"], C["border"])
        s.line_rect(x, 150, 250, 5, color)
        s.text(title, x + 24, 174, 160, 20, 18, color, True)
        s.bullets(bullets, x + 24, 212, 190, 130, 12)

    # Class diagrams.
    s = d.add_slide("Diagrammes")
    s.add_title("Diagramme de classes - Vue d'ensemble", "Le modele est decoupe par domaines pour rester lisible.")
    s.flow(["Identity", "Knowledge", "CRM", "Collaboration", "Live Chat", "AI", "Training", "Ops"], 35, 150, 890)
    s.bullets(["Les classes d'entites sont stockees cote backend en JPA.", "Chaque domaine possede controllers, services et repositories dedies.", "Relations principales : User -> Roles/Status/Assignments, Article -> Maps/Tracking/Feedback, ChatProject -> Workflow/Queue/Sessions.", "Les slides suivantes detaillent les classes par domaine."], 78, 285, 820, 130, 16)

    class_slide(d, "Diagramme de classes - Identity & Access", [
        ("User", ["id", "firstName", "lastName", "email", "password", "role", "active", "timeZone", "status"], 55, 150, 190, 110, C["blue"]),
        ("UserStatus", ["id", "userId", "status", "updatedAt"], 290, 150, 180, 95, C["cyan"]),
        ("UserStatusHistory", ["id", "userId", "fromStatus", "toStatus", "createdAt"], 515, 150, 190, 100, C["cyan"]),
        ("RoleAccessProfile", ["id", "roleKey", "label", "active"], 55, 315, 190, 95, C["green"]),
        ("RoleAccessLink", ["id", "roleKey", "featureKey", "enabled"], 290, 315, 190, 95, C["green"]),
        ("TeamLink", ["id", "agentId", "tlId", "qaId"], 515, 315, 190, 95, C["orange"]),
        ("UserSettings", ["language", "timezone", "jira", "notifications"], 738, 230, 170, 95, C["blue"]),
    ])
    class_slide(d, "Diagramme de classes - Knowledge & Decision", [
        ("KbCategory", ["id", "name", "displayOrder"], 48, 145, 170, 92, C["blue"]),
        ("KbArticle", ["id", "categoryId", "title", "contentHtml", "active"], 260, 145, 190, 105, C["blue"]),
        ("KbMapNode", ["id", "articleId", "title", "contentHtml", "x", "y"], 495, 145, 190, 105, C["cyan"]),
        ("KbMapEdge", ["id", "sourceNodeId", "targetNodeId", "label"], 725, 145, 180, 95, C["cyan"]),
        ("KbArticleTimeLog", ["id", "articleId", "userId", "seconds", "source"], 48, 315, 190, 100, C["green"]),
        ("Page", ["id", "title", "content", "tag"], 280, 315, 170, 90, C["orange"]),
        ("Choice", ["id", "label", "sourcePageId", "targetPageId"], 495, 315, 190, 95, C["orange"]),
        ("CaseTagNode/Edge", ["id", "label", "parent", "target"], 725, 315, 180, 90, C["green"]),
    ])
    class_slide(d, "Diagramme de classes - CRM & Communication", [
        ("CemContact", ["id", "name", "email", "phone"], 55, 145, 170, 90, C["blue"]),
        ("CemConversation", ["id", "contactId", "subject", "status", "assignee"], 270, 145, 200, 105, C["blue"]),
        ("CemInternalNote", ["id", "conversationId", "authorId", "content", "createdAt"], 515, 145, 200, 105, C["cyan"]),
        ("GmailAccount", ["id", "email", "accessToken", "refreshToken", "expiresAt"], 740, 145, 170, 105, C["green"]),
        ("ChatChannelLink", ["id", "provider", "externalId", "active"], 55, 320, 180, 90, C["orange"]),
        ("ChatConversation", ["id", "channel", "customer", "status"], 285, 320, 180, 90, C["orange"]),
        ("ChatMessage", ["id", "conversationId", "sender", "body", "sentAt"], 515, 320, 190, 100, C["orange"]),
        ("ChatParticipant", ["id", "conversationId", "userId", "role"], 740, 320, 170, 90, C["orange"]),
    ])
    class_slide(d, "Diagramme de classes - Live Chat Routing", [
        ("ChatProject", ["id", "name", "slug", "status", "api"], 55, 135, 180, 98, C["cyan"]),
        ("ChatProjectApiKey", ["id", "projectId", "tokenHash", "scope"], 280, 135, 190, 98, C["cyan"]),
        ("ChatWorkflow", ["projectId", "status", "publishedAt"], 515, 135, 190, 90, C["cyan"]),
        ("ChatWorkflowNode", ["id", "type", "payload", "x", "y"], 740, 135, 170, 98, C["cyan"]),
        ("ChatQueue", ["id", "projectId", "name", "status"], 55, 310, 180, 92, C["green"]),
        ("ChatQueueAgent", ["queueId", "userId", "priority", "active"], 280, 310, 190, 92, C["green"]),
        ("LiveChatSession", ["projectId", "queueId", "status", "customer"], 515, 310, 190, 100, C["blue"]),
        ("LiveChatMessage", ["sessionId", "senderType", "body", "createdAt"], 740, 310, 170, 98, C["blue"]),
    ])
    class_slide(d, "Diagramme de classes - AI, Training, QA & Ops", [
        ("ProcessAssistantConversation", ["id", "userId", "title", "profileId"], 50, 145, 210, 96, C["blue"]),
        ("ProcessAssistantMessage", ["conversationId", "role", "content", "createdAt"], 305, 145, 210, 96, C["blue"]),
        ("PromptProfile/RoleLink", ["prompt", "model", "apiKey", "role"], 560, 145, 190, 96, C["cyan"]),
        ("TrainingAsset", ["id", "type", "path", "duration", "owner"], 50, 315, 185, 96, C["green"]),
        ("QaEvaluation", ["id", "ticketId", "agentId", "score", "comments"], 275, 315, 190, 96, C["green"]),
        ("EscalationTicket", ["id", "clientId", "priority", "status", "jiraKey"], 505, 315, 205, 100, C["orange"]),
        ("EscalationComment", ["ticketId", "authorId", "body", "createdAt"], 750, 315, 160, 96, C["orange"]),
    ])

    s = d.add_slide("Classes")
    s.add_title("Inventaire complet des principales classes metier", "Liste synthetique issue de la structure backend observee.")
    inventory = [
        "User, UserStatus, UserStatusHistory, TeamLink, RoleAccessProfile, RoleAccessLink",
        "KbCategory, KbArticle, KbMapNode, KbMapEdge, KbArticleTimeLog",
        "Page, Choice, CaseTagNode, CaseTagEdge",
        "CemContact, CemConversation, CemInternalNote, GmailAccount",
        "CollaborationRoom, CollaborationRoomMember, CollaborationMessage, Reaction, Mention",
        "ChatProject, ChatProjectApiKey, ChatWorkflow, ChatWorkflowNode, ChatWorkflowConnection",
        "ChatQueue, ChatQueueAgent, LiveChatSession, LiveChatMessage, LiveChatAssignment",
        "ProcessAssistantConversation, ProcessAssistantMessage, PromptProfile, PromptRoleLink",
        "TrainingAsset, QaEvaluation, EscalationTicket, EscalationComment, WorkflowExecution",
    ]
    s.bullets(inventory, 70, 150, 830, 280, 14)

    sequence_flows = [
        ("Diagramme de sequence - Login et acces V3", ["Utilisateur", "Login Angular", "Auth API", "JWT", "V3 Shell", "RoleGuard"], ["L'utilisateur saisit identifiant et mot de passe.", "Angular appelle /auth/login.", "Spring Security valide et retourne le JWT.", "Le shell charge profil, role, langue, statut et droits.", "RoleGuard bloque les pages non autorisees."]),
        ("Diagramme de sequence - Lecture article et analytics", ["Agent", "Knowledge Base", "KbArticle API", "Timer", "KbAnalytics API", "Dashboard"], ["L'agent selectionne un article.", "L'article et sa carte SOP sont charges.", "Un heartbeat enregistre le temps passe.", "Le feedback like/dislike est associe a l'article.", "KB Analytics consolide les temps par agent et article."]),
        ("Diagramme de sequence - Public Chat vers agent", ["Client", "Public Chat", "Workflow", "Queue", "Assignment", "Agent"], ["Le client ouvre /chat/{slug}.", "Le workflow execute choix, texte, booleen ou message.", "Une escalade selectionne une queue projet.", "L'agent disponible avec le moins de chats actifs est choisi.", "Le live chat continue en WebSocket jusqu'a cloture et CSAT."]),
        ("Diagramme de sequence - Escalade L1/L2 et Jira", ["L1", "Escalation API", "Queue L2", "L2 Playlist", "Jira Bridge", "Status"], ["L1 cree un ticket avec Client ID, issues, priorite et description.", "Le ticket arrive dans la queue L2.", "Un L2 clique Play : le plus ancien ticket non assigne lui est verrouille.", "L2 ajoute commentaires et peut creer un ticket Jira via backend.", "La resolution est controlee par le statut interne et Jira."]),
    ]
    for title, steps, bullets in sequence_flows:
        s = d.add_slide("Sequences")
        s.add_title(title, "Flux technique simplifie entre frontend, backend, base et integrations.")
        s.flow(steps, 45, 165, 870)
        s.bullets(bullets, 88, 300, 800, 120, 16)

    s = d.add_slide("Donnees")
    s.add_title("Modele de donnees", "La base est organisee par domaines pour rester extensible.")
    s.bullets(["User est au centre des acces, de la presence, des assignations, QA et settings.", "KbArticle est lie aux categories, maps, feedbacks et logs de temps.", "ChatProject isole workflows, queues, API keys et sessions publiques.", "EscalationTicket relie L1/L2 et Jira sans melanger CRM et delivery.", "ProcessAssistant separe conversations, messages et profils de prompt."], 76, 152, 820, 165, 17)
    s.flow(["User", "Roles", "Modules", "Events", "Analytics"], 90, 350, 760, C["soft_cyan"])

    s = d.add_slide("Architecture")
    s.add_title("Architecture du systeme", "Separation frontend, backend, base et integrations.")
    s.flow(["Angular V3", "REST API", "Spring Services", "JPA", "MySQL"], 58, 150, 845)
    s.flow(["Public Chat", "WebSocket", "Live Chat", "Agent UI"], 170, 270, 620, C["soft_blue"])
    s.bullets(["Les secrets Gmail/OpenAI/Jira restent cote backend.", "Les modules frontend consomment des services HTTP types.", "Les donnees sensibles sont protegees par JWT et controles serveur.", "Docker facilite le deploiement local, VPS ou cloud."], 110, 392, 740, 90, 14)

    s = d.add_slide("Architecture")
    s.add_title("Architecture de deploiement", "Cible Oracle Cloud Free Tier ou VPS client.")
    s.flow(["HTTPS", "Reverse Proxy", "Angular SSR", "Spring API", "MySQL", "Volumes"], 40, 160, 880)
    s.bullets(["Nginx/Caddy pour TLS, proxy /api et /ws.", "Frontend SSR Node pour servir l'application.", "Backend Spring Boot pour REST, WebSocket et integrations.", "MySQL/MariaDB avec sauvegardes, volume persistant et restrictions reseau.", "Variables d'environnement pour secrets et configuration."], 82, 292, 800, 130, 16)

    s = d.add_slide("Backend")
    s.add_title("Carte des APIs backend", "Endpoints regroupes par domaine metier.")
    s.bullets(["/auth/login : authentification.", "/api/kb, /api/kb-map, /api/kb/analytics : connaissance.", "/api/crm, /api/gmail, /api/case-tags : CRM et emails.", "/api/chat-projects, /api/public/chat, /api/live-chat : chatbot et live chat.", "/api/process-assistant : IA et prompts.", "/api/access-control, /api/staff, /api/settings : administration.", "/api/escalations, /api/jira : L1/L2 et Jira."], 72, 148, 820, 245, 17)

    s = d.add_slide("Implementation")
    s.add_title("Developpement / Implementation", "Le projet combine implementation produit et logique d'exploitation.")
    s.bullets(["Frontend : composants Angular standalone, lazy-loaded routes, services par domaine.", "Backend : Spring Boot controllers, services metier, repositories JPA.", "Securite : JWT, guards, role access map, comptes actifs/desactives.", "Temps reel : WebSocket pour collaboration et live chat.", "Fichiers et medias : assets d'entrainement stockes cote serveur.", "Documentation : rapport PFE, guide Oracle Cloud, scripts de generation de slides."], 78, 155, 820, 240, 18)

    s = d.add_slide("Fonctionnalites")
    s.add_title("Fonctionnalites principales", "Vue synthetique des fonctions demontrees.")
    s.bullets(["CRM Inbox : emails, tickets, notes internes, tags, pieces jointes.", "Knowledge Base : articles, cartes SOP, feedback, analytics d'usage.", "Magic Assistance : arbres de decision pour procedures agents.", "Process Copilot : assistant IA avec historique et prompts par role.", "Collaboration + Live Chat : messages internes et conversations client temps reel.", "Academy + QA + Adherence : formation, evaluation et pilotage.", "Role Access Map : acces configurables et evolutifs."], 78, 155, 820, 250, 18)

    screens = [
        ("Login", "01-login.png", ["Acces securise", "Identifiants", "Animation login", "Theme V3"]),
        ("Command Center", "02-command-center.png", ["Dashboard central", "Navigation V3", "Quick jumps", "Acces role-based"]),
        ("Calendar", "03-calendar.png", ["Planification", "Vue calendrier", "Evenements", "Organisation equipe"]),
        ("CRM Inbox", "04-crm-inbox.png", ["Tickets email", "Files et cas", "Statuts", "Travail agent"]),
        ("CRM Ticket Detail", "05-crm-ticket-detail.png", ["Conversation", "Reponse agent", "Notes internes", "Piece jointe"]),
        ("Magic Assistance", "06-magic-assistance.png", ["Arbre decision", "Guidage agent", "Processus", "Etapes"]),
        ("Knowledge Base", "07-knowledge-base.png", ["Articles", "Categories", "Recherche", "SOP map"]),
        ("KB Analytics", "08-kb-analytics.png", ["Temps lecture", "Agents", "Articles", "Usage"]),
        ("Collaboration Hub", "09-collaboration-hub.png", ["Canaux", "DM", "Messages", "Notifications"]),
        ("Chat Projects", "10-chat-projects.png", ["Projets chatbot", "Workflow", "Queues", "API key"]),
        ("Live Chat", "11-live-chat.png", ["Sessions", "Conversation", "Assignation", "Agent"]),
        ("Process Copilot", "12-process-assistant.png", ["Assistant IA", "Prompts", "Historique", "Roles"]),
        ("Academy - My Trainings", "13-academy-home.png", ["Formations", "Progression", "Cours", "Certification"]),
        ("Academy - Catalog", "14-academy-catalog.png", ["Catalogue", "Recherche", "Parcours", "Autoformation"]),
        ("Academy - Course Viewer", "15-academy-course-viewer.png", ["Lecture cours", "Etapes", "Video", "Temps"]),
        ("Academy - Certificate", "16-academy-certificate.png", ["Certificat", "Validation", "Reconnaissance", "Tracabilite"]),
        ("Academy - Studio", "17-academy-studio.png", ["Creation cours", "Modules", "Contenu", "Publication"]),
        ("Academy - Course Editor", "18-academy-course-editor.png", ["Edition", "Sections", "Video upload", "Quiz"]),
        ("Academy - Analytics", "19-academy-analytics.png", ["Suivi temps", "Completion", "Agents", "Cours"]),
        ("Staff Management", "20-staff-management.png", ["Comptes", "Roles", "Activation", "Reset password"]),
        ("Tree Builder", "21-tree-builder.png", ["Noeuds", "Connecteurs", "Auto layout", "Save DB"]),
        ("KB Map Builder", "22-kb-map-builder.png", ["SOP maps", "Article map", "Details", "Pan/zoom"]),
        ("Case Tag Builder", "23-case-tag-builder.png", ["Typologies", "Categories", "Sous-categories", "Tags"]),
        ("Prompt Map Builder", "24-prompt-map-builder.png", ["Prompts", "Roles", "API key", "LLM"]),
        ("Article Management", "25-article-management.png", ["CRUD articles", "Categories", "Edition", "Publication"]),
        ("Article Editor", "26-article-editor.png", ["Edition full page", "Contenu", "Rich editor", "Save"]),
        ("Role Access Map", "27-role-access-map.png", ["Roles", "Features", "Liens", "Permissions"]),
        ("Settings", "28-settings.png", ["Profil", "Mot de passe", "Jira", "Preferences"]),
        ("Adherence Dashboard", "29-adherence-dashboard.png", ["Timeline", "Statuts", "Agents", "Supervision"]),
        ("QA Evaluation", "30-qa-evaluation.png", ["Evaluation", "Scores", "Tickets", "Feedback"]),
        ("Team Management", "31-team-management.png", ["Liens TL/QA", "Agents", "Map", "Organisation"]),
        ("Channel Access Map", "32-channel-access-map.png", ["Canaux", "Invitations", "Acces", "Collaboration"]),
        ("FlowDesk Board", "33-flowdesk-board.png", ["Board", "Delivery", "Tasks", "Suivi"]),
        ("FlowDesk Backlog", "34-flowdesk-backlog.png", ["Backlog", "Priorites", "Demandes", "Planification"]),
        ("FlowDesk Sprints", "35-flowdesk-sprints.png", ["Sprints", "Plan", "Execution", "Suivi"]),
        ("FlowDesk Reports", "36-flowdesk-reports.png", ["Rapports", "KPI", "Analyse", "Delivery"]),
        ("FlowDesk Escalations", "37-flowdesk-escalations.png", ["L1/L2", "Playlist", "Jira", "Resolution"]),
        ("404 Page", "38-v3-not-found.png", ["Page systeme", "UX erreur", "Navigation", "Robustesse"]),
        ("Article Not Found", "39-article-not-found.png", ["Erreur article", "Guidage", "Retour KB", "UX"]),
    ]
    for title, file_name, notes in screens:
        screenshot_slide(d, title, file_name, notes)

    final_slides = [
        ("Difficultes rencontrees et solutions", ["Mise a jour Angular non reactive : listeners, state refresh et change detection.", "Integrations externes : Gmail token expiration, Jira CORS, OpenAI quota/API key.", "Builders visuels : alignement des connecteurs, pan/zoom, liaison de noeuds.", "Gestion des droits : passage d'une logique code a une logique DB configurable.", "Live chat : besoin de WebSocket et persistence DB pour eviter le local-only.", "Production : separation des secrets, Docker, reverse proxy et sauvegardes."]),
        ("Resultats obtenus", ["39 captures V3 integrees au deck.", "Plus de 20 modules/pages operationnels.", "APIs REST et temps reel WebSocket.", "Deploiement Docker prepare.", "Architecture full stack modulaire et presentable en soutenance."]),
        ("Limites du projet", ["Remplacer ddl-auto update par Flyway ou Liquibase.", "Ajouter tests unitaires, integration, E2E et tests de charge.", "Mettre en place observabilite : logs structures, metrics, alerting.", "Chiffrer les secrets et externaliser la configuration sensible.", "Renforcer les validations serveur pour chaque permission critique."]),
        ("Perspectives d'amelioration", ["SSO Keycloak, multi-tenancy, audit trail complet.", "RAG et recherche semantique sur la Knowledge Base.", "WhatsApp, Instagram, Messenger, Telegram et voice support.", "SLA, business hours, skills-based routing et macros.", "Kubernetes, CI/CD, monitoring et blue-green deployment.", "Portail client public : tickets, status, KB et CSAT."]),
        ("Conclusion", ["Focal V3 est un projet full stack complet, oriente valeur metier.", "Il couvre CRM, KB, SOP maps, IA, collaboration, live chat, formation, QA, adherence, roles et escalade.", "La valeur principale : rendre les agents plus rapides, les reponses plus coherentes et le pilotage plus mesurable."]),
    ]
    for title, bullets in final_slides:
        s = d.add_slide("Conclusion")
        s.add_title(title, "Synthese finale de la valeur projet.")
        s.bullets(bullets, 78, 155, 820, 240, 18)

    s = d.add_slide("Questions")
    s.rect(0, 0, PX_W, PX_H, C["navy"], None, "rect")
    s.line_rect(0, 0, 960, 6, C["cyan"])
    s.text("Questions ?", 80, 155, 700, 68, 48, C["white"], True)
    s.text("Merci pour votre attention", 84, 235, 600, 30, 20, C["cyan"], True)
    s.text("Projet de Fin d'Etudes - Focal V3 - Abdelfattah AZELMADI", 84, 420, 760, 24, 13, "D2DCEB")

    return d


if __name__ == "__main__":
    deck = build_deck()
    deck.save(OUT)
    print(OUT)
    print(f"slides={len(deck.slides)}")
    print(f"media={len(deck.media)}")
