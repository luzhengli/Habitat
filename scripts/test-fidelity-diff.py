"""Regression checks for the screenshot evidence tool, using disposable captures."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from PIL import Image

SCRIPT = Path(__file__).with_name('fidelity-diff.py')

class FidelityEvidenceTest(unittest.TestCase):
    def run_capture(self, left, right, raster=(100, 80), scrolls=None):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            for side, elements in [('prototype', left), ('production', right)]:
                Image.new('RGB', raster, 'white').save(folder / (side + '.png'))
                metadata = {
                    'viewport': {'width': 100, 'height': 80, 'dpr': 1},
                    'elements': elements,
                }
                if scrolls is not None:
                    metadata['scroll'] = {'left': 0, 'top': scrolls[side]}
                (folder / (side + '.json')).write_text(json.dumps(metadata))
            result = subprocess.run([sys.executable, str(SCRIPT), str(folder)], capture_output=True, text=True)
            report = folder / 'comparison.json'
            return result, json.loads(report.read_text()) if report.exists() else None

    @staticmethod
    def card(y):
        return {'selector': 'skill-card', 'x': 10, 'y': y, 'width': 80, 'height': 20}

    def test_each_card_uses_its_corresponding_row(self):
        result, report = self.run_capture([self.card(10), self.card(40)], [self.card(10), self.card(45)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual([row['delta']['y'] for row in report['geometry']], [0, 5])
        self.assertEqual([row['occurrence'] for row in report['geometry']], [1, 2])

    def test_missing_card_is_reported_not_reused(self):
        result, report = self.run_capture([self.card(10), self.card(40)], [self.card(10)])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(len(report['geometry']), 1)
        self.assertEqual(report['unmatchedPrototype'][0]['occurrence'], 2)

    def test_two_equally_cropped_images_are_rejected(self):
        result, report = self.run_capture([self.card(10)], [self.card(10)], raster=(100, 60))
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(report)
        self.assertIn('does not cover', result.stderr)

    def test_optional_metadata_does_not_shift_the_next_card(self):
        first = dict(self.card(10), selector='ownership', scope='card:0')
        second = dict(self.card(40), selector='ownership', scope='card:1')
        result, report = self.run_capture([second], [first, second])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report['geometry'][0]['delta']['y'], 0)
        self.assertEqual(report['unmatchedProduction'][0]['scope'], 'card:0')

    def test_different_scroll_positions_are_rejected(self):
        result, report = self.run_capture([self.card(10)], [self.card(10)], scrolls={'prototype': 20, 'production': 21})
        self.assertNotEqual(result.returncode, 0)
        self.assertIsNone(report)
        self.assertIn('scroll positions differ', result.stderr)

if __name__ == '__main__':
    unittest.main()
