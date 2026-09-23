from __future__ import annotations

from pathlib import Path
from xml.etree import ElementTree as ET

STYLE_PATH = Path(__file__).with_name("aspen-keys.mss")


def patch_musicxml(path: Path, title: str) -> None:
    tree = ET.parse(path)
    root = tree.getroot()

    work = root.find("work")
    if work is None:
        work = ET.Element("work")
        root.insert(0, work)

    work_title = work.find("work-title")
    if work_title is None:
        work_title = ET.SubElement(work, "work-title")
    work_title.text = title

    movement = root.find("movement-title")
    if movement is None:
        movement = ET.Element("movement-title")
        root.insert(1, movement)
    movement.text = title

    identification = root.find("identification")
    if identification is None:
        identification = ET.Element("identification")
        root.insert(2, identification)

    arranger = identification.find("creator[@type='arranger']")
    if arranger is None:
        arranger = ET.SubElement(identification, "creator", {"type": "arranger"})
    arranger.text = "Aspen Keys"

    encoding = identification.find("encoding")
    if encoding is None:
        encoding = ET.SubElement(identification, "encoding")

    software = encoding.find("software")
    if software is None:
        software = ET.SubElement(encoding, "software")
    software.text = "Aspen Keys"

    tree.write(path, encoding="utf-8", xml_declaration=True)
