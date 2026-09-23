import tempfile
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

from engraving import STYLE_PATH, patch_musicxml


class EngravingTests(unittest.TestCase):
    def test_style_file_is_valid_xml(self):
        root = ET.parse(STYLE_PATH).getroot()
        self.assertEqual(root.tag, "museScore")

    def test_patch_sets_title_and_aspen_keys_credit(self):
        source = """<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list/>
</score-partwise>
"""
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "score.musicxml"
            path.write_text(source, encoding="utf-8")

            patch_musicxml(path, "Goodday")

            root = ET.parse(path).getroot()
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


if __name__ == "__main__":
    unittest.main()
