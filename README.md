Hi,

This is fundamentally a prototype project that I built to learn about Retrieval-Augmented-Generation. It was a great time but it's not production ready at all. AKA do not try and build this yourself because there are no instructions. Watch the video below for a run-through.

**[Watch a brief demo](https://www.youtube.com/watch?v=G3z4znwcduA)**

Stack:
- Qdrant for vector database
- Python and FastAPI for backend
- Supabase for chat storage
- Cloudflare R2 for chunk storage
- React Router and ShadCN/UI for frontend
- OpenAI for chat models
- Cohere for ranking


Simple process:

1) Document is uploaded, is chunked based on a custom algorithm to be split into small sizes and uploaded Cloudflare R2.
2) The code calls OpenAI's vector embedding model to cheaply convert those chunks into vector representations, and uploads that to Qdrant.
3) When a user sends a new query, it makes a call to OpenAI's vector embedding model again.
4) That new vector embedding is then compared against the database of 'chunked' embeddings from before, and a list is provided based on semantic similarity.
5) Calls Cohere's specialised 'ranking' model to determine which of the given results are most appropriate.
6) Feeds the acquired chunks directly into the context of the generic OpenAI chat call.
7) Result is returned to user!
