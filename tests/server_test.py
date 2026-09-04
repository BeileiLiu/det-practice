import os
import tempfile
import unittest

import server


class PublicFileTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        for rel in ('index.html', 'server.env', 'server.py', 'js/app.js', 'images/p.jpg', 'fonts/a.woff2'):
            path = os.path.join(self.tmp.name, *rel.split('/'))
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'wb') as file:
                file.write(b'x')

    def tearDown(self):
        self.tmp.cleanup()

    def resolve(self, path):
        return server._public_file_for_path(path, self.tmp.name)

    def test_public_assets_are_served(self):
        self.assertTrue(self.resolve('/'))
        self.assertTrue(self.resolve('/index.html'))
        self.assertTrue(self.resolve('/js/app.js?v=1'))
        self.assertTrue(self.resolve('/images/p.jpg'))
        self.assertTrue(self.resolve('/fonts/a.woff2'))

    def test_server_files_and_traversal_are_blocked(self):
        self.assertIsNone(self.resolve('/server.env'))
        self.assertIsNone(self.resolve('/server.py'))
        self.assertIsNone(self.resolve('/docs/REFACTOR_AUDIT.md'))
        self.assertIsNone(self.resolve('/../server.env'))
        self.assertIsNone(self.resolve('/js/../server.env'))


if __name__ == '__main__':
    unittest.main()
