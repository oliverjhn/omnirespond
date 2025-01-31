from dataclasses import dataclass

@dataclass
class DocumentChunk:
    text: str

    def __str__(self) -> str:
        return self.text
