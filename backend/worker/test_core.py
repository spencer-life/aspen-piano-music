import unittest

from core import sanitize_title, validate_youtube_url


class CoreTests(unittest.TestCase):
    def test_sanitizes_filename_characters(self):
        self.assertEqual(sanitize_title('Goodday: Aspen/Keys?'), 'Goodday- Aspen-Keys')

    def test_accepts_youtube_urls(self):
        self.assertEqual(
            validate_youtube_url('https://youtu.be/P883-nSegbY'),
            'https://youtu.be/P883-nSegbY',
        )

    def test_rejects_non_youtube_urls(self):
        with self.assertRaises(ValueError):
            validate_youtube_url('https://example.com/song')


if __name__ == '__main__':
    unittest.main()
