from typing import List
from abc import ABC, abstractmethod
import tempfile
import os
from io import BytesIO
import pypdf
import pymupdf4llm
from .base import BaseService
from .types import DocumentChunk
from .base import log_timing
from google import genai
import pypdfium2 as pdfium


class TextExtractor(ABC):
    @abstractmethod
    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        """Extract and chunk text from the document. Returns list of chunks."""
        pass


class PyPDFExtractor(TextExtractor):
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        try:
            pdf_file = BytesIO(content)
            reader = pypdf.PdfReader(pdf_file)
            text = "\n".join(page.extract_text() for page in reader.pages)

            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i : i + self.chunk_size])
                chunks.append(DocumentChunk(text=chunk_text))
            return chunks

        except Exception:
            raise


class GeminiPDFExtractor(TextExtractor):
    def __init__(self, settings):
        self.client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        num_pages = len(pdfium.PdfDocument(content))
        pass


class UnstructuredPDFExtractor(TextExtractor):
    def __init__(self, max_characters: int = 1500, new_after_n_chars: int = 1500):
        self.max_characters = max_characters
        self.new_after_n_chars = new_after_n_chars

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        from unstructured.partition.pdf import partition_pdf
        from unstructured.chunking.basic import chunk_elements

        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            elements = partition_pdf(temp_file_path, strategy="hi_res")
            chunks = list(
                chunk_elements(
                    elements,
                    max_characters=self.max_characters,
                    new_after_n_chars=self.new_after_n_chars,
                )
            )

            return [DocumentChunk(text=chunk.text) for chunk in chunks]
        finally:
            os.unlink(temp_file_path)


class StandardPDFExtractor(TextExtractor):
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        try:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as temp_pdf:
                temp_pdf.write(content)
                temp_pdf.flush()
                text = pymupdf4llm.to_markdown(temp_pdf.name)

            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i : i + self.chunk_size])
                chunks.append(DocumentChunk(text=chunk_text))
            return chunks

        except Exception:
            raise


class PlainTextExtractor(TextExtractor):
    def __init__(self, chunk_size: int = 256, overlap: int = 32):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def process(self, content: bytes, filename: str = None) -> List[DocumentChunk]:
        try:
            text = content.decode("utf-8")
            words = text.split()
            chunks = []
            for i in range(0, len(words), self.chunk_size - self.overlap):
                chunk_text = " ".join(words[i : i + self.chunk_size])
                chunks.append(DocumentChunk(text=chunk_text))
            return chunks
        except Exception:
            raise


class ExtractorService(BaseService):
    def __init__(self, settings):
        super().__init__()
        self.extractors = {".pdf": PyPDFExtractor(), ".txt": PlainTextExtractor()}

    def set_extractor(self, extension: str, extractor_type: str):
        if extension == ".pdf":
            if extractor_type == "standard":
                self.extractors[".pdf"] = StandardPDFExtractor()
            elif extractor_type == "unstructured":
                self.extractors[".pdf"] = UnstructuredPDFExtractor()
            elif extractor_type == "pypdf":
                self.extractors[".pdf"] = PyPDFExtractor()

    @log_timing
    async def process_document(
        self, content: bytes, filename: str
    ) -> List[DocumentChunk]:
        try:
            extension = "." + filename.split(".")[-1].lower()
            if extension not in self.extractors:
                raise ValueError(f"Unsupported file type: {extension}")

            return self.extractors[extension].process(content, filename)
        except Exception as e:
            self.logger.error(f"Document extraction failed: {str(e)}")
            raise
