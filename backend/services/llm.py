from .base import BaseService, log_timing
from openai import OpenAI
from google import genai
from cohere import ClientV2
from typing import List, Dict


class LLMService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self.openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
        self.gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.cohere_client = ClientV2(api_key=settings.COHERE_API_KEY)

    @log_timing
    async def generate_openai_response(
        self, query: str, context: str, model: str = None
    ) -> str:
        try:
            model = model or self.settings.OPENAI_MODEL_NAME
            prompt = f"Query: {query}\n\nRelevant Context:\n{context}\n\nResponse:"

            response = self.openai_client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": """You are trained on the users documents and are able to answer questions about them. 
                     You will ONLY use the information provided in the relevant context to answer the question, 
                     and if you need to use information from your internal knowledge, you will explicitly state that. You will be as concise as possible.""",
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            self.logger.error(f"Failed to generate OpenAI response: {str(e)}")
            raise

    @log_timing
    async def generate_gemini_response(
        self, query: str, context: str, model: str = None
    ) -> str:
        try:
            model = model or self.settings.GEMINI_MODEL_NAME
            prompt = f"Query: {query}\n\nRelevant Context:\n{context}\n\nResponse:"

            response = self.gemini_client.models.generate_content(
                model=model,
                config=genai.types.GenerateContentConfig(
                    system_instruction="""You are trained on the users documents and are able to answer questions about them. 
                     You will ONLY use the information provided in the relevant context to answer the question, 
                     and if you need to use information from your internal knowledge, you will explicitly state that.""",
                ),
                contents=prompt,
            )
            return response.text
        except Exception as e:
            self.logger.error(f"Failed to generate Gemini response: {str(e)}")
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
