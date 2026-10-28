import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('routing',Path(__file__).with_name('nginx-portfolio.py'));routing=importlib.util.module_from_spec(spec);spec.loader.exec_module(routing)
class RoutingTest(unittest.TestCase):
 def test_removes_only_portfolio(self):
  portfolio='server {\n server_name th.io.vn;\n location / { try_files $uri /index.html; }\n}\n';mes='server {\n server_name mes.th.io.vn;\n location /api/ { proxy_pass http://127.0.0.1:3000; }\n}\n';self.assertEqual(routing.remove_portfolio(portfolio+mes).strip(),mes.strip())
 def test_existing_partition_is_unchanged(self):
  text='server {\n server_name mes.th.io.vn;\n}\n';self.assertEqual(routing.remove_portfolio(text),text)
 def test_ambiguous_hosts_and_duplicates_are_rejected(self):
  for text in ['server {\nserver_name th.io.vn mes.th.io.vn;\n}', 'server {\nserver_name th.io.vn;\n}\nserver {\nserver_name th.io.vn;\n}']:
   with self.assertRaises(ValueError):routing.remove_portfolio(text)
 def test_quoted_braces_and_comments(self):
  text='server {\nserver_name th.io.vn;\nset $a "}"; # }\n}\nserver {\nserver_name mes.th.io.vn;\n}';self.assertNotIn('server_name th.io.vn',routing.remove_portfolio(text))
if __name__=='__main__':unittest.main()
