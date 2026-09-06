from .base import BaseService, log_timing
from openai import OpenAI
from cohere import ClientV2
from typing import List, Dict


class LLMService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.cohere_client = ClientV2(api_key=settings.COHERE_API_KEY)

    def _debug_print_conversation(self, messages: List[Dict[str, str]]) -> None:
        """Print conversation messages in a readable format for debugging."""
        print("\n=== Debug: Conversation Flow ===")
        for idx, msg in enumerate(messages, 1):
            role = msg.get("role", "unknown").upper()
            content = msg.get("content", "").replace("\n", "\n\t")
            print(f"\n{idx}. [{role}]:\n\t{content}")
        print("\n==============================\n")

    @log_timing
    async def generate_openai_response(
        self,
        query: str,
        context: str,
        conversation: List[Dict[str, str]],  # Each dict has 'content' and 'role' keys
        model: str = None,
    ) -> str:
        try:
            model = model or self.settings.OPENAI_MODEL_NAME

            messages = [
                {
                    "role": "system",
                    "content": (
                        "You are given access to context from the users documents to answer questions about them. "
                        "You will ONLY use the information provided in the relevant context to answer the question, "
                        "and if you need to use information from your internal knowledge, you will explicitly state that. "
                        "You will be as concise as possible."
                    ),
                }
            ]

            # # Add context as a system message
            # if context:
            #     messages.append(
            #         {
            #             "role": "system",
            #             "content": f"Relevant context from documents:\n{context}",
            #         }
            #     )

            # Add conversation history
            messages.extend(conversation)

            # Add the user's query as the latest message
            messages.append(
                {
                    "role": "user",
                    "content": f"Query: {query}\n\nRelevant Context:\n{context}\n\nResponse:",
                }
            )

            self._debug_print_conversation(messages)

            response = self.openai_client.responses.create(model=model, input=messages)

            return response.output_text
        except Exception as e:
            self.logger.error(f"Failed to generate OpenAI response: {str(e)}")
            raise

    @log_timing
    async def generate_title(
        self, prompt: str, model: str = None
    ) -> str:
        try:
            model = model or self.settings.OPENAI_MODEL_NAME
            response = self.openai_client.responses.create(
                model=model,
                instructions=(
                    "Create a concise 3-5 word chat title. Return only the title, "
                    "without quotation marks, labels, or punctuation at the end."
                ),
                input=prompt,
                max_output_tokens=64,
            )
            title = response.output_text.strip().strip('"').strip()
            if not title:
                raise ValueError("OpenAI returned an empty title")
            return title
        except Exception as e:
            self.logger.error(f"Failed to generate chat title: {str(e)}")
            raise

    @log_timing
    async def rerank_documents(
        self, query: str, documents: List[Dict], limit: int = 100
    ) -> List[Dict]:
        try:
            # Convert documents to format expected by Cohere
            texts = [doc["text"] for doc in documents]

            # Get rerank results
            response = self.cohere_client.rerank(
                query=query, documents=texts, top_n=limit, model="rerank-v3.5"
            )

            # Map reranked results back to original documents with scores
            reranked_docs = []
            for result in response.results:
                doc = documents[result.index]
                doc["score"] = float(result.relevance_score)
                reranked_docs.append(doc)

            # return documents
            return reranked_docs

        except Exception as e:
            self.logger.error(f"Failed to rerank documents: {str(e)}")
            raise
