from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import html
import re

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE = Path(r"C:\Users\asus\Downloads\template.docx")
MD_IN = ROOT / "docs" / "pfe" / "rapport-pfe-focal-assist-v3.md"
DOCX_OUT = ROOT / "docs" / "pfe" / "rapport-pfe-focal-assist-v3.docx"

TITLE = (
    "Plateforme omnicanale d’assistance opérationnelle et de gestion des "
    "connaissances : conception et réalisation de Focal V3"
)
AUTHOR = "Abdelfattah AZELMADI"


def esc(value: str) -> str:
    return html.escape(str(value), quote=False)


def run(text: str, bold=False, italic=False, color=None, size=22) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    if size:
        props.append(f'<w:sz w:val="{size}"/><w:szCs w:val="{size}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(text)}</w:t></w:r>'


def paragraph(text="", kind="normal") -> str:
    text = text.strip()
    if kind == "h1":
        ppr = (
            '<w:pPr><w:keepNext/><w:spacing w:before="420" w:after="180"/>'
            '<w:outlineLvl w:val="0"/></w:pPr>'
        )
        return f'<w:p>{ppr}{run(text, bold=True, color="003B73", size=34)}</w:p>'
    if kind == "h2":
        ppr = (
            '<w:pPr><w:keepNext/><w:spacing w:before="300" w:after="140"/>'
            '<w:outlineLvl w:val="1"/></w:pPr>'
        )
        return f'<w:p>{ppr}{run(text, bold=True, color="006C80", size=28)}</w:p>'
    if kind == "h3":
        ppr = (
            '<w:pPr><w:keepNext/><w:spacing w:before="220" w:after="100"/>'
            '<w:outlineLvl w:val="2"/></w:pPr>'
        )
        return f'<w:p>{ppr}{run(text, bold=True, color="1B2A41", size=24)}</w:p>'
    if kind == "bullet":
        ppr = '<w:pPr><w:spacing w:after="80"/><w:ind w:left="420" w:hanging="220"/></w:pPr>'
        return f'<w:p>{ppr}{run("• ", color="00A7A5", size=22)}{run(text, size=22)}</w:p>'
    if kind == "number":
        ppr = '<w:pPr><w:spacing w:after="80"/><w:ind w:left="420" w:hanging="220"/></w:pPr>'
        return f"<w:p>{ppr}{run(text, size=22)}</w:p>"
    ppr = '<w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr>'
    return f"<w:p>{ppr}{run(text, size=22)}</w:p>"


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def cell(text: str, header=False) -> str:
    shade = '<w:shd w:fill="E6F6F5"/>' if header else ""
    tcpr = f'<w:tcPr><w:tcW w:w="0" w:type="auto"/>{shade}</w:tcPr>'
    clean = text.strip().replace("**", "")
    ppr = '<w:pPr><w:spacing w:after="60"/></w:pPr>'
    return f'<w:tc>{tcpr}<w:p>{ppr}{run(clean, bold=header, color="003B73" if header else None, size=20)}</w:p></w:tc>'


def table(rows) -> str:
    if not rows:
        return ""
    borders = (
        '<w:tblBorders>'
        '<w:top w:val="single" w:sz="4" w:color="BFD8D7"/>'
        '<w:left w:val="single" w:sz="4" w:color="BFD8D7"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="BFD8D7"/>'
        '<w:right w:val="single" w:sz="4" w:color="BFD8D7"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="D9E7E7"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="D9E7E7"/>'
        "</w:tblBorders>"
    )
    parts = [f'<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>{borders}</w:tblPr>']
    for ri, row in enumerate(rows):
        parts.append("<w:tr>")
        for value in row:
            parts.append(cell(value, header=ri == 0))
        parts.append("</w:tr>")
    parts.append("</w:tbl>")
    parts.append('<w:p><w:pPr><w:spacing w:after="160"/></w:pPr></w:p>')
    return "".join(parts)


def parse_md_table(lines):
    parsed = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c.replace(" ", "")) for c in cells):
            continue
        parsed.append(cells)
    return parsed


def md_to_word_xml(md: str) -> str:
    output = [page_break()]
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        if line.strip().startswith("|"):
            block = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            output.append(table(parse_md_table(block)))
            continue
        if line.startswith("# "):
            output.append(paragraph(line[2:], "h1"))
        elif line.startswith("## "):
            output.append(paragraph(line[3:], "h2"))
        elif line.startswith("### "):
            output.append(paragraph(line[4:], "h3"))
        elif line.startswith("- "):
            output.append(paragraph(line[2:], "bullet"))
        elif re.match(r"^\d+\.\s+", line):
            output.append(paragraph(line, "number"))
        else:
            para = [line]
            j = i + 1
            while j < len(lines):
                nxt = lines[j].rstrip()
                if not nxt.strip():
                    break
                if nxt.startswith("#") or nxt.startswith("- ") or nxt.strip().startswith("|") or re.match(r"^\d+\.\s+", nxt):
                    break
                para.append(nxt)
                j += 1
            text = " ".join(para)
            text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
            output.append(paragraph(text, "normal"))
            i = j
            continue
        i += 1
    return "".join(output)


def replace_text_node(xml: str, old: str, new: str, count=1) -> str:
    pattern = re.compile(r"(<w:t(?:\s+[^>]*)?>)" + re.escape(old) + r"(</w:t>)")
    return pattern.sub(lambda m: m.group(1) + esc(new) + m.group(2), xml, count=count)


def main() -> None:
    md = MD_IN.read_text(encoding="utf-8")
    content_xml = md_to_word_xml(md)

    with ZipFile(TEMPLATE, "r") as zin:
        document_xml = zin.read("word/document.xml").decode("utf-8")

    document_xml = replace_text_node(document_xml, "SUJET", TITLE, 1)
    document_xml = replace_text_node(document_xml, "Cycle / ", "Cycle d’ingénieur", 1)
    document_xml = replace_text_node(document_xml, "Licence", "", 1)
    document_xml = replace_text_node(document_xml, " / Master", "", 1)
    document_xml = replace_text_node(document_xml, "……………………………………………………", AUTHOR, 1)

    sect_match = re.search(r"<w:sectPr[\s\S]*?</w:sectPr>\s*</w:body>", document_xml)
    if sect_match:
        document_xml = document_xml[: sect_match.start()] + content_xml + document_xml[sect_match.start() :]
    else:
        document_xml = document_xml.replace("</w:body>", content_xml + "</w:body>")

    with ZipFile(TEMPLATE, "r") as zin, ZipFile(DOCX_OUT, "w", ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "word/document.xml":
                data = document_xml.encode("utf-8")
            zout.writestr(item, data)

    print(DOCX_OUT)
    print(f"markdown_bytes={MD_IN.stat().st_size}")
    print(f"docx_bytes={DOCX_OUT.stat().st_size}")


if __name__ == "__main__":
    main()
