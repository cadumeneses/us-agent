"""Credential propagation at the Python HTTP boundaries; no network or .env reads."""
import os
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import Mock, patch

from agent.api_client import AgentApiClient
import export_results_csv


class ApiCredentialsTests(unittest.TestCase):
    def test_worker_authenticates_reads_and_writes(self):
        with patch.dict(os.environ, {"INGEST_API_KEY": "synthetic-test-credential"}, clear=True):
            client = AgentApiClient()
        client.session = Mock()
        client.session.get.return_value.json.return_value = {"version": "1", "modules": {"Module": ["Operation"]}}
        client.session.post.return_value.json.return_value = {"id": "1"}
        client.load_taxonomy()
        client.save_classification({"synthetic": True})
        for call in [client.session.get.call_args, client.session.post.call_args]:
            self.assertEqual(call.kwargs["headers"], {"Authorization": "Bearer synthetic-test-credential"})
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(AgentApiClient()._headers(), {})

    def test_export_authenticates_without_writing_credentials_to_csv(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "results.csv"
            response = Mock()
            response.json.return_value = [{"id": "1", "text": "Synthetic story"}]
            with patch.dict(os.environ, {"INGEST_API_KEY": "synthetic-test-credential"}, clear=True), \
                    patch.object(export_results_csv, "load_dotenv"), \
                    patch.object(export_results_csv, "parse_args", return_value=Namespace(output=str(output), project=None)), \
                    patch.object(export_results_csv.requests, "get", return_value=response) as get:
                export_results_csv.main()
            self.assertEqual(get.call_args.kwargs["headers"], {"Authorization": "Bearer synthetic-test-credential"})
            self.assertNotIn("synthetic-test-credential", output.read_text(encoding="utf-8-sig"))


if __name__ == "__main__":
    unittest.main()
