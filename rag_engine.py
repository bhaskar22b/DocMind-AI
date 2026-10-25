
# rag_engine.py — Lightweight PDF RAG using keyword retrieval + Groq

import os
import re
import math
from collections import Counter

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_groq import ChatGroq
from langchain_core.documents import Document
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda, RunnablePassthrough


def tokenize(text):
    """Convert text into lowercase word tokens."""
    return re.findall(r"\b[a-zA-Z0-9]+\b", text.lower())


class LightweightRetriever:
    """Rank document chunks by keyword relevance without an ML model."""

    def __init__(self, documents):
        self.documents = documents
        self.tokenized_docs = [
            tokenize(doc.page_content) for doc in documents
        ]

        self.doc_frequencies = Counter()

        for tokens in self.tokenized_docs:
            self.doc_frequencies.update(set(tokens))

        self.total_docs = len(documents)

    def invoke(self, question):
        """Return the four most relevant chunks."""
        query_tokens = set(tokenize(question))

        if not query_tokens or not self.documents:
            return []

        scores = []

        for index, tokens in enumerate(self.tokenized_docs):
            counts = Counter(tokens)
            score = 0.0

            for word in query_tokens:
                frequency = counts[word]

                if frequency == 0:
                    continue

                document_frequency = self.doc_frequencies[word]

                # Inverse document frequency: emphasize distinctive words.
                idf = math.log(
                    1 + self.total_docs / (1 + document_frequency)
                )

                # Simple term-frequency score.
                score += (1 + math.log(frequency)) * idf

            scores.append((score, index))

        ranked = sorted(scores, reverse=True)

        # If no query terms match, return no context rather than random text.
        if not ranked or ranked[0][0] <= 0:
            return []

        return [
            self.documents[index]
            for score, index in ranked[:4]
            if score > 0
        ]


def load_and_index_pdf(pdf_path: str):
    """Load a text-based PDF and split it into searchable chunks."""

    print("[INFO] Loading PDF...")

    loader = PyPDFLoader(pdf_path)
    documents = loader.load()

    total_text = sum(len(doc.page_content) for doc in documents)

    print(
        f"[INFO] Extracted {total_text} characters "
        f"from {len(documents)} pages"
    )

    if total_text < 100:
        raise ValueError(
            "This PDF has very little extractable text. "
            "It may be scanned or image-only. OCR is not configured."
        )

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
    )

    chunks = splitter.split_documents(documents)

    if not chunks:
        raise ValueError("No readable text chunks were found in the PDF.")

    print(f"[INFO] Created {len(chunks)} searchable chunks")

    return chunks


def build_qa_chain(documents):
    """Build the retrieval and Groq question-answering chain."""

    groq_api_key = os.environ.get("GROQ_API_KEY")

    if not groq_api_key:
        raise ValueError(
            "GROQ_API_KEY is missing. Add it to your .env file "
            "or your hosting provider's environment variables."
        )

    retriever = LightweightRetriever(documents)

    llm = ChatGroq(
        model="openai/gpt-oss-20b",
        temperature=0,
        groq_api_key=groq_api_key,
    )

    def retrieve_docs(question):
        docs = retriever.invoke(question)

        if not docs:
            return []

        return docs

    def format_docs(docs):
        if not docs:
            return "No relevant information was found in the document."

        return "\n\n---\n\n".join(
            doc.page_content for doc in docs
        )

    retriever_runnable = RunnableLambda(retrieve_docs)

    prompt = PromptTemplate.from_template(
        "You are a helpful assistant analyzing a document.\n"
        "Answer using ONLY the information in the context below.\n"
        "If the context says no relevant information was found, or "
        "the answer is not supported by the context, say "
        "'This information is not in the document.'\n"
        "Be clear, concise, and natural.\n\n"
        "Context:\n{context}\n\n"
        "Question: {question}\n\n"
        "Answer:"
    )

    chain = (
        {
            "context": retriever_runnable | format_docs,
            "question": RunnablePassthrough(),
        }
        | prompt
        | llm
        | StrOutputParser()
    )

    # Return a retriever with the same invoke(question) interface
    # expected by app.py for source-page citations.
    return chain, retriever
