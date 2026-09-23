import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from engraving import STYLE_PATH, parse_chord_events, patch_musicxml


class EngravingTests(unittest.TestCase):
    def test_style_file_is_valid_xml(self):
        root = ET.parse(STYLE_PATH).getroot()
        self.assertEqual(root.tag, "museScore")

    def test_parse_picogen_chord_events(self):
        source = """Event(spec: spec_ss)
Event(metric: tempo_60)
Event(bar: bar_start)
Event(metric: position_0)
Event(metric: chord_C_M7)
Event(metric: position_8)
Event(metric: chord_A_m7)
Event(bar: bar_end)
Event(bar: bar_start)
Event(metric: position_0)
Event(metric: chord_F_M)
Event(bar: bar_end)
"""
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "piano.txt"
            path.write_text(source, encoding="utf-8")
            chords = parse_chord_events(path)

        self.assertEqual(len(chords), 3)
        self.assertEqual((chords[0].measure_index, chords[0].position, chords[0].root, chords[0].quality), (0, 0, "C", "M7"))
        self.assertEqual((chords[1].measure_index, chords[1].position, chords[1].root, chords[1].quality), (0, 8, "A", "m7"))
        self.assertEqual((chords[2].measure_index, chords[2].root), (1, "F"))

    def test_patch_sets_title_credit_and_chords(self):
        score = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>4</divisions>
        <time><beats>4</beats><beat-type>4</beat-type></time>
      </attributes>
      <note><rest/><duration>16</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
"""
        events = """Event(bar: bar_start)
Event(metric: position_0)
Event(metric: chord_C_M7)
Event(metric: position_8)
Event(metric: chord_A_m7)
Event(bar: bar_end)
"""

        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "score.musicxml"
            event_path = Path(tmp) / "piano.txt"
            path.write_text(score, encoding="utf-8")
            event_path.write_text(events, encoding="utf-8")

            chord_count = patch_musicxml(path, "Goodday", event_path)

            root = ET.parse(path).getroot()
            harmonies = root.findall("part/measure/harmony")

            self.assertEqual(chord_count, 2)
            self.assertEqual(root.findtext("work/work-title"), "Goodday")
            self.assertEqual(root.findtext("movement-title"), "Goodday")
            self.assertEqual(
                root.findtext("identification/creator[@type='arranger']"),
                "Aspen Keys",
            )
            self.assertEqual(
                root.findtext("identification/encoding/software"),
                "Aspen Keys",
            )
            self.assertEqual(len(harmonies), 2)
            self.assertEqual(harmonies[0].findtext("root/root-step"), "C")
            self.assertEqual(harmonies[0].findtext("kind"), "major-seventh")
            self.assertEqual(harmonies[1].findtext("root/root-step"), "A")
            self.assertEqual(harmonies[1].findtext("offset"), "8")


if __name__ == "__main__":
    unittest.main()
