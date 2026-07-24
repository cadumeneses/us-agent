import unittest

from agent.quality_plan import build_quality_plan_prompts, recommend_quality_plan
from agent.schemas import QualityPlanOutput


class QualityPlanPromptTest(unittest.TestCase):
    def test_builds_prompt_with_structured_context(self):
        system, user = build_quality_plan_prompts(
            user_story="Como usuário, quero recuperar minha senha.",
            classification_rows=[{"module": "Authentication", "operation": "Password recovery"}],
            classification_confidence=0.91,
            uncertainty_score=0.08,
            uncertainty_band="low",
            review_status="accepted_auto",
            evidence=["recuperar minha senha"],
        )
        self.assertIn("general_quality_practice", system)
        self.assertIn('"module": "Authentication"', user)
        self.assertIn("<user_story>", user)

    def test_schema_preserves_assumption_and_basis(self):
        output = QualityPlanOutput.model_validate({
            "readiness": "needs_clarification",
            "summary": "A validade do token não foi informada.",
            "questions": [{
                "text": "Por quanto tempo o token permanece válido?",
                "reason": "A resposta altera os testes de expiração.",
                "priority": "high"
            }],
            "acceptance_criteria": [],
            "test_cases": [],
            "risks": [{
                "description": "Token sem política de expiração definida.",
                "impact": "high",
                "requires_clarification": True
            }],
            "warnings": []
        })
        self.assertEqual(output.readiness, "needs_clarification")
        self.assertTrue(output.risks[0].requires_clarification)

    def test_runs_with_a_compatible_provider(self):
        class FakeProvider:
            def recommend_quality(self, system, user):
                self.received = (system, user)
                return QualityPlanOutput(
                    readiness="ready",
                    summary="Plano gerado.",
                    questions=[],
                    acceptance_criteria=[],
                    test_cases=[],
                    risks=[],
                    warnings=[],
                )

        provider = FakeProvider()
        result = recommend_quality_plan(
            provider,
            user_story="Como usuário, quero consultar meus dados.",
            classification_rows=[{"module": "Registry", "operation": "Retrieve data"}],
            classification_confidence=0.9,
            uncertainty_score=0.1,
            uncertainty_band="low",
            review_status="accepted_auto",
        )
        self.assertEqual(result.readiness, "ready")
        self.assertIn("consultar meus dados", provider.received[1])


if __name__ == "__main__":
    unittest.main()
