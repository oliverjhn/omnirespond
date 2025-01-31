from typing import List, Dict
from .base import BaseService
from openai import OpenAI

class LLMService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.settings = settings
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
        
    async def generate_response(self, query: str, context: str, model: str = None) -> str:
        try:
            model = model or self.settings.OPENAI_MODEL_NAME
            prompt = f"Query: {query}\n\nRelevant Context:\n{context}\n\nResponse:"
            
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": """You are trained on the users documents and are able to answer questions about them. 
                     You will ONLY use the information provided in the relevant context to answer the question, 
                     and if you need to use information from your internal knowledge, you will explicitly state that."""},
                    {"role": "user", "content": prompt}
                ],
            )
            return response.choices[0].message.content
        except Exception as e:
            self.logger.error(f"Failed to generate LLM response: {str(e)}")
            raise
