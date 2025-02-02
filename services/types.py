from dataclasses import dataclass
from typing import Dict, Optional

@dataclass
class DocumentChunk:
    text: str
    sparse_vector: Optional[Dict[int, float]] = None

    def __str__(self) -> str:
        return self.text
