from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

STYLE_PATH = Path(__file__).with_name("aspen-keys.mss")
BEAT_DIVISION = 4

_EVENT_RE = re.compile(r"^Event\((?P<etype>[^:]+): (?P<value>.+)\)$")
_KIND_MAP = {
    "M": ("major", ""),
    "m": ("minor", "m"),
    "7": ("dominant", "7"),
    "M7": ("major-seventh", "maj7"),
    "m7": ("minor-seventh", "m7"),
    "o": ("diminished", "dim"),
    "o7": ("diminished-seventh", "dim7"),
    "/o7": ("half-diminished", "ø7"),
    "+": ("augmented", "+"),
    "sus2": ("suspended-second", "sus2"),
    "sus4": ("suspended-fourth", "sus4"),
}


@dataclass(frozen=True)
class ChordPlacement:
    measure_index: int
    position: int
    root: str
    quality: str


def parse_chord_events(path: Path) -> list[ChordPlacement]:
    if not path.exists():
        return []

    measure_index = -1
    position = 0
    placements: list[ChordPlacement] = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        match = _EVENT_RE.match(raw_line.strip())
        if not match:
            continue

        etype = match.group("etype")
        value = match.group("value")

        if etype == "bar" and value == "bar_start":
            measure_index += 1
            position = 0
            continue

        if etype != "metric" or measure_index < 0:
            continue

        if value.startswith("position_"):
            try:
                position = int(value.removeprefix("position_"))
            except ValueError:
                position = 0
            continue

        if not value.startswith("chord_") or value == "chord_N_N":
            continue

        chord = value.removeprefix("chord_")
        root, _, quality = chord.partition("_")
        if root and quality:
            placements.append(
                ChordPlacement(
                    measure_index=measure_index,
                    position=position,
                    root=root,
                    quality=quality,
                )
            )

    return placements


def _make_harmony(chord: ChordPlacement, divisions: int) -> ET.Element:
    harmony = ET.Element("harmony")

    root = ET.SubElement(harmony, "root")
    step = chord.root[0]
    ET.SubElement(root, "root-step").text = step
    if len(chord.root) > 1 and chord.root[1] == "#":
        ET.SubElement(root, "root-alter").text = "1"

    kind_name, display = _KIND_MAP.get(chord.quality, ("other", chord.quality))
    kind = ET.SubElement(harmony, "kind")
    kind.text = kind_name
    if display:
        kind.set("text", display)

    offset = round(chord.position * divisions / BEAT_DIVISION)
    if offset:
        ET.SubElement(harmony, "offset").text = str(offset)

    ET.SubElement(harmony, "staff").text = "1"
    return harmony


def add_chord_symbols(root: ET.Element, placements: list[ChordPlacement]) -> int:
    if not placements:
        return 0

    part = root.find("part")
    if part is None:
        return 0

    measures = part.findall("measure")
    by_measure: dict[int, list[ChordPlacement]] = {}
    for chord in placements:
        by_measure.setdefault(chord.measure_index, []).append(chord)

    divisions = 1
    inserted = 0

    for measure_index, measure in enumerate(measures):
        attributes = measure.find("attributes")
        if attributes is not None:
            divisions_text = attributes.findtext("divisions")
            if divisions_text:
                try:
                    divisions = max(1, int(divisions_text))
                except ValueError:
                    pass

        chords = by_measure.get(measure_index, [])
        if not chords:
            continue

        insert_at = 0
        for index, child in enumerate(list(measure)):
            if child.tag in {"print", "attributes"}:
                insert_at = index + 1

        for chord in reversed(chords):
            measure.insert(insert_at, _make_harmony(chord, divisions))
            inserted += 1

    return inserted


def patch_musicxml(path: Path, title: str, chord_event_file: Path | None = None) -> int:
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

    chord_count = 0
    if chord_event_file is not None:
        chord_count = add_chord_symbols(root, parse_chord_events(chord_event_file))

    tree.write(path, encoding="utf-8", xml_declaration=True)
    return chord_count
