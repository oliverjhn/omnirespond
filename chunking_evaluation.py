from dataclasses import dataclass
from typing import List, Dict, Any, Optional
import time
import statistics
import numpy as np
from collections import defaultdict
import matplotlib.pyplot as plt
import seaborn as sns
from io import BytesIO
import json
from utils import TextExtractor, DocumentProcessor, OpenAIEmbedder
from qdrant_client.models import PointStruct
from openai import OpenAI

@dataclass
class ChunkMetrics:
    chunk_count: int
    avg_chunk_size: float
    std_chunk_size: float
    min_chunk_size: int
    max_chunk_size: int
    processing_time: float
    memory_usage: float
    
@dataclass
class AccuracyMetrics:
    answer_similarity: float    # Semantic similarity to ground truth
    context_relevance: float   # How relevant the retrieved chunks were
    answer_correctness: float  # LLM evaluation of correctness

@dataclass
class SearchMetrics:
    avg_search_time: float
    accuracy: AccuracyMetrics

@dataclass
class EvaluationResult:
    strategy_name: str
    chunk_metrics: ChunkMetrics
    search_metrics: SearchMetrics
    raw_data: Dict[str, Any]

class ChunkingStrategyEvaluator:
    def __init__(
        self,
        doc_processor: DocumentProcessor,
        test_documents: List[bytes],
        test_queries: List[str],
        ground_truth: List[str],
        openai_client: Optional[OpenAI] = None
    ):
        self.doc_processor = doc_processor
        self.test_documents = test_documents
        self.test_queries = test_queries
        self.ground_truth = ground_truth
        self.openai_client = openai_client or OpenAI()
        self.results = {}
        # Add in-memory storage for chunks
        self.chunk_storage = {}

    def store_chunks(self, collection_name: str, chunks: List[Any]) -> str:
        """Store chunks in memory instead of S3"""
        document_key = f"{collection_name}/test_doc"
        # Convert chunks to strings before storing
        self.chunk_storage[document_key] = [str(chunk) if hasattr(chunk, '__str__') else chunk for chunk in chunks]
        return document_key

    def get_chunks(self, document_key: str) -> List[Any]:
        """Retrieve chunks from memory"""
        return self.chunk_storage.get(document_key, [])

    def measure_chunk_metrics(self, extractor: TextExtractor, content: bytes) -> ChunkMetrics:
        start_time = time.time()
        chunks = extractor.process(content)
        processing_time = time.time() - start_time

        # Calculate chunk sizes
        chunk_sizes = [len(chunk.text if hasattr(chunk, 'text') else chunk) for chunk in chunks]
        
        return ChunkMetrics(
            chunk_count=len(chunks),
            avg_chunk_size=statistics.mean(chunk_sizes),
            std_chunk_size=statistics.stdev(chunk_sizes) if len(chunk_sizes) > 1 else 0,
            min_chunk_size=min(chunk_sizes),
            max_chunk_size=max(chunk_sizes),
            processing_time=processing_time,
            memory_usage=0  # TODO: Implement memory tracking
        )

    def evaluate_answer_accuracy(
        self,
        query: str,
        generated_answer: str,
        ground_truth: str,
        retrieved_chunks: List[str]
    ) -> AccuracyMetrics:
        # Calculate semantic similarity using embeddings
        embedder = self.doc_processor.embedder
        answer_embedding = embedder.generate_embeddings([generated_answer])[0]
        truth_embedding = embedder.generate_embeddings([ground_truth])[0]
        similarity = float(np.dot(answer_embedding, truth_embedding))

        # Have LLM evaluate answer correctness and context relevance
        evaluation_prompt = f"""
        You are a very strict evaluator. Your job is to find any small differences or imperfections between the generated answer and ground truth.

        Query: {query}
        Retrieved Context: {' '.join(retrieved_chunks)}
        Generated Answer: {generated_answer}
        Ground Truth: {ground_truth}

        Scoring Guidelines (be extremely critical):
        1. Answer Correctness (0.0-1.0):
           - 1.0: EXACT match with ground truth (rare)
           - 0.9: Near perfect but tiny variations in wording
           - 0.7-0.8: Good match but missing nuances or minor details
           - 0.5-0.6: Core message correct but missing important details
           - 0.3-0.4: Some correct points but significant omissions
           - 0.1-0.2: Mostly incorrect with few correct elements
           - 0.0: Completely wrong or unrelated

        2. Context Relevance (0.0-1.0):
           - 1.0: PERFECT context match (rare)
           - 0.9: Almost all relevant information with minor gaps
           - 0.7-0.8: Most key information present but some missing
           - 0.5-0.6: Important information present but significant gaps
           - 0.3-0.4: Some relevant information but mostly incomplete
           - 0.1-0.2: Mostly irrelevant with few useful pieces
           - 0.0: Completely irrelevant

        Remember: A score of 1.0 should be EXTREMELY rare - it means absolutely perfect match.
        Provide scores in JSON format: {{"correctness": float, "relevance": float}}
        """

        response = self.openai_client.chat.completions.create(
            model="gpt-4o-mini", #Always keep as this model
            messages=[
                {"role": "system", "content": "You are an extremely strict evaluator. Perfect scores (1.0) should be nearly impossible to achieve. Always find something that could be improved."},
                {"role": "user", "content": evaluation_prompt}
            ],
            temperature=0.3
        )
        
        try:
            response_text = response.choices[0].message.content
            if "```json" in response_text:
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            
            evaluation = json.loads(response_text)
            
            if not all(k in evaluation for k in ['correctness', 'relevance']):
                print(f"Warning: Incomplete evaluation response: {evaluation}")
                evaluation = {"correctness": 0.0, "relevance": 0.0}
            
            # Ensure values are between 0 and 1
            evaluation['correctness'] = max(0.0, min(0.95, float(evaluation['correctness'])))
            evaluation['relevance'] = max(0.0, min(0.95, float(evaluation['relevance'])))
                
        except json.JSONDecodeError:
            print(f"Warning: Could not parse evaluation response: {response.choices[0].message.content}")
            evaluation = {"correctness": 0.0, "relevance": 0.0}

        return AccuracyMetrics(
            answer_similarity=similarity,
            context_relevance=float(evaluation["relevance"]),
            answer_correctness=float(evaluation["correctness"])
        )

    def search_documents(self, collection_name: str, query: str, limit: int = 5) -> List[Dict]:
        """Local version of search_documents that doesn't use S3"""
        timing = {
            'embed_start': time.time(),
            'total_s3': 0,
            'total_processing': 0
        }
        
        # Generate query embedding
        query_embedding = self.doc_processor.embedder.generate_embeddings([query])[0]
        
        # Search Qdrant
        search_results = self.doc_processor.client.search(
            collection_name=collection_name,
            query_vector=query_embedding.tolist(),
            limit=limit
        )
        
        # Process results - using text directly from payload
        results = []
        for result in search_results:
            results.append({
                "score": result.score,
                "chunk_index": result.payload["chunk_index"],
                "file_name": result.payload["file_name"],
                "text": result.payload["text"],
                "metadata": result.payload.get("metadata", {})
            })
        
        return results

    def process_query(
        self,
        collection_name: str,
        query: str,
        ground_truth: str
    ) -> Optional[Dict[str, Any]]:
        """Process a single query and return the results"""
        try:
            # Clean up query and ground truth if they're string representations of lists
            query = query.strip('[]"\' ') if isinstance(query, str) else query
            ground_truth = ground_truth.strip('[]"\' ') if isinstance(ground_truth, str) else ground_truth
            
            results = self.search_documents(collection_name, query)
            if not results:
                return None
            
            # Convert chunks to strings if they're DocumentChunk objects
            retrieved_chunks = [
                str(r['text']) if hasattr(r['text'], '__str__') else r['text'] 
                for r in results
            ]
            
            # Generate answer using retrieved chunks
            answer_prompt = f"""
            Based on the following context, answer the question.
            
            Context: {' '.join(retrieved_chunks)}
            
            Question: {query}
            
            Answer:
            """
            
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions based on provided context."},
                    {"role": "user", "content": answer_prompt}
                ]
            )
            
            generated_answer = response.choices[0].message.content
            
            # Evaluate accuracy
            accuracy_metrics = self.evaluate_answer_accuracy(
                query=query,
                generated_answer=generated_answer,
                ground_truth=ground_truth,
                retrieved_chunks=retrieved_chunks
            )
            
            return {
                "query": query,
                "ground_truth": ground_truth,
                "generated_answer": generated_answer,
                "accuracy_metrics": {
                    "similarity": f"{accuracy_metrics.answer_similarity:.2f}",
                    "correctness": f"{accuracy_metrics.answer_correctness:.2f}",
                    "relevance": f"{accuracy_metrics.context_relevance:.2f}"
                }
            }
            
        except Exception as e:
            print(f"Error processing query: {str(e)}")
            return None

    def measure_search_metrics(
        self,
        collection_name: str,
        queries: List[str]
    ) -> SearchMetrics:
        search_times = []
        successful_queries = 0
        accuracy_metrics_list = []
        query_results = []

        print(f"\nProcessing {len(queries)} queries for {collection_name}")

        for query, ground_truth in zip(queries, self.ground_truth):
            try:
                print(f"\nQuery: {query[:100]}...")
                
                start_time = time.time()
                result = self.process_query(collection_name, query, ground_truth)
                search_time = time.time() - start_time
                
                if result:
                    search_times.append(search_time)
                    successful_queries += 1
                    query_results.append(result)
                    
                    # Extract accuracy metrics for averaging
                    accuracy_metrics_list.append(AccuracyMetrics(
                        answer_similarity=float(result["accuracy_metrics"]["similarity"]),
                        context_relevance=float(result["accuracy_metrics"]["relevance"]),
                        answer_correctness=float(result["accuracy_metrics"]["correctness"])
                    ))

            except Exception as e:
                print(f"Error processing query '{query[:100]}...': {str(e)}")
                continue

        # Calculate average metrics
        avg_accuracy = AccuracyMetrics(
            answer_similarity=statistics.mean([m.answer_similarity for m in accuracy_metrics_list]) if accuracy_metrics_list else 0,
            context_relevance=statistics.mean([m.context_relevance for m in accuracy_metrics_list]) if accuracy_metrics_list else 0,
            answer_correctness=statistics.mean([m.answer_correctness for m in accuracy_metrics_list]) if accuracy_metrics_list else 0
        )

        metrics = SearchMetrics(
            avg_search_time=statistics.mean(search_times) if search_times else 0,
            accuracy=avg_accuracy
        )

        # Store query results
        self.results[collection_name] = query_results

        return metrics

    def evaluate_strategy(
        self,
        extractor: TextExtractor,
        strategy_name: str,
        collection_name: str
    ) -> EvaluationResult:
        print(f"\nEvaluating strategy: {strategy_name}")
        
        # Process test documents and measure chunk metrics
        chunk_metrics_list = []
        
        for doc in self.test_documents:
            # Process document and measure metrics
            start_time = time.time()
            chunks = extractor.process(doc)
            processing_time = time.time() - start_time

            # Calculate chunk sizes
            chunk_sizes = [len(chunk.text if hasattr(chunk, 'text') else chunk) for chunk in chunks]
            
            metrics = ChunkMetrics(
                chunk_count=len(chunks),
                avg_chunk_size=statistics.mean(chunk_sizes),
                std_chunk_size=statistics.stdev(chunk_sizes) if len(chunk_sizes) > 1 else 0,
                min_chunk_size=min(chunk_sizes),
                max_chunk_size=max(chunk_sizes),
                processing_time=processing_time,
                memory_usage=0
            )
            chunk_metrics_list.append(metrics)
            
            # Store chunks and embeddings
            document_key = self.store_chunks(collection_name, chunks)
            
            # Convert chunks to strings for embedding
            chunk_texts = [str(chunk) if hasattr(chunk, '__str__') else chunk for chunk in chunks]
            embeddings = self.doc_processor.embedder.generate_embeddings(chunk_texts)
            
            # Store in Qdrant
            points = [
                PointStruct(
                    id=self.doc_processor.generate_chunk_id("test_doc", str(chunk)),
                    vector=embedding.tolist(),
                    payload={
                        "file_name": "test_doc",
                        "chunk_index": idx,
                        "document_key": document_key,
                        "metadata": chunk.metadata if hasattr(chunk, 'metadata') else {},
                        "text": str(chunk) if hasattr(chunk, '__str__') else str(chunk)
                    }
                )
                for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings))
            ]
            self.doc_processor.client.upsert(collection_name=collection_name, points=points)

        # Measure search metrics and get query results
        search_metrics = self.measure_search_metrics(collection_name, self.test_queries)
        
        # Get the query results that were stored in self.results
        query_results = self.results.get(collection_name, [])  # Changed from dict to list access

        # Aggregate chunk metrics
        avg_chunk_metrics = ChunkMetrics(
            chunk_count=int(statistics.mean([m.chunk_count for m in chunk_metrics_list])),
            avg_chunk_size=statistics.mean([m.avg_chunk_size for m in chunk_metrics_list]),
            std_chunk_size=statistics.mean([m.std_chunk_size for m in chunk_metrics_list]),
            min_chunk_size=min([m.min_chunk_size for m in chunk_metrics_list]),
            max_chunk_size=max([m.max_chunk_size for m in chunk_metrics_list]),
            processing_time=statistics.mean([m.processing_time for m in chunk_metrics_list]),
            memory_usage=statistics.mean([m.memory_usage for m in chunk_metrics_list])
        )

        return EvaluationResult(
            strategy_name=strategy_name,
            chunk_metrics=avg_chunk_metrics,
            search_metrics=search_metrics,
            raw_data={
                "chunk_metrics_list": [vars(m) for m in chunk_metrics_list],
                "query_results": query_results,  # Store the complete list of query results
                "strategy_name": strategy_name
            }
        )

class ChunkingAnalysisReport:
    def __init__(self, results: List[EvaluationResult]):
        self.results = results

    def generate_metrics_visualization(self) -> Dict[str, BytesIO]:
        """Generate visualizations for the evaluation results"""
        plots = {}

        
        # Chunk size distribution
        plt.figure(figsize=(10, 6))
        data = [(r.strategy_name, r.chunk_metrics.avg_chunk_size) for r in self.results]
        sns.barplot(x=[d[0] for d in data], y=[d[1] for d in data])
        plt.title("Average Chunk Size by Strategy")
        plt.xticks(rotation=45)
        
        buf = BytesIO()
        plt.savefig(buf, format='png', bbox_inches='tight')
        buf.seek(0)
        plots['chunk_size_distribution'] = buf

        # Add more visualizations as needed
        
        return plots

    def generate_summary_report(self) -> Dict[str, Any]:
        """Generate a more readable and detailed summary report"""
        strategy_summaries = []
        
        for result in self.results:
            query_results = result.raw_data.get("query_results", [])

            summary = {
                "strategy_name": result.strategy_name,
                "chunking_metrics": {
                    "number_of_chunks": result.chunk_metrics.chunk_count,
                    "average_chunk_size": f"{result.chunk_metrics.avg_chunk_size:.0f} chars",
                    "chunk_size_range": f"{result.chunk_metrics.min_chunk_size} - {result.chunk_metrics.max_chunk_size} chars",
                    "processing_time": f"{result.chunk_metrics.processing_time:.2f} seconds"
                },
                "accuracy_scores": {
                    "semantic_similarity": f"{result.search_metrics.accuracy.answer_similarity:.2f}/1.0",
                    "answer_correctness": f"{result.search_metrics.accuracy.answer_correctness:.2f}/1.0",
                    "context_relevance": f"{result.search_metrics.accuracy.context_relevance:.2f}/1.0"
                },
                "queries": query_results
            }
            strategy_summaries.append(summary)

        return {
            "Strategy Comparisons": strategy_summaries,
            "Recommendations": self._generate_recommendations()
        }

    def _generate_recommendations(self) -> List[str]:
        """Generate consolidated recommendations comparing all strategies"""
        # Sort strategies by different metrics
        by_speed = sorted(self.results, key=lambda x: x.chunk_metrics.processing_time)
        by_accuracy = sorted(self.results, 
                           key=lambda x: (x.search_metrics.accuracy.answer_correctness + 
                                        x.search_metrics.accuracy.context_relevance) / 2,
                           reverse=True)
        by_search = sorted(self.results, 
                         key=lambda x: x.search_metrics.avg_search_time,
                         reverse=True)
        
        # Create comparison strings for each metric
        speed_comparison = " > ".join(f"{r.strategy_name} ({r.chunk_metrics.processing_time:.2f}s)" 
                                    for r in by_speed)
        accuracy_comparison = " > ".join(
            f"{r.strategy_name} ({(r.search_metrics.accuracy.answer_correctness + r.search_metrics.accuracy.context_relevance) / 2:.2f})" 
            for r in by_accuracy
        )
        search_comparison = " > ".join(f"{r.strategy_name} ({r.search_metrics.avg_search_time:.2f}s)" 
                                     for r in by_search)
        
        return [
            f"Strategy Comparison (from best to worst):",
            f"- Processing Speed: {speed_comparison}",
            f"- Answer Accuracy: {accuracy_comparison}",
            f"- Search Performance: {search_comparison}"
        ]