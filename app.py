
# app.py — Flask server with hosted Hugging Face embeddings + Groq RAG

import os
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_from_directory

# Project directory
BASE_DIR = Path(__file__).resolve().parent

# Load local .env without overriding hosting environment variables
load_dotenv(dotenv_path=BASE_DIR / ".env")

# Import after loading environment variables
from rag_engine import load_and_index_pdf, build_qa_chain

app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
)

app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024  # 20 MB upload limit

qa_chain = None
retriever = None


@app.route("/")
def index():
    """Serve the main HTML interface."""
    return send_from_directory(app.static_folder, "index.html")


@app.route("/upload", methods=["POST"])
def upload_pdf():
    """Upload a PDF, create its FAISS index, and prepare the QA chain."""
    global qa_chain, retriever

    if "file" not in request.files:
        return jsonify({
            "success": False,
            "message": "No file uploaded.",
        }), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({
            "success": False,
            "message": "Please select a file.",
        }), 400

    if not file.filename.lower().endswith(".pdf"):
        return jsonify({
            "success": False,
            "message": "Only PDF files are accepted.",
        }), 400

    tmp_path = None

    try:
        # Save PDF temporarily for PyPDFLoader
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=".pdf",
        ) as tmp:
            tmp_path = tmp.name
            file.save(tmp_path)

        # Generate hosted embeddings and create FAISS index
        vector_store = load_and_index_pdf(tmp_path)

        # Prepare the Groq question-answering chain
        new_qa_chain, new_retriever = build_qa_chain(vector_store)

        # Replace active chain only after setup succeeds
        qa_chain = new_qa_chain
        retriever = new_retriever

        return jsonify({
            "success": True,
            "message": "PDF indexed successfully!",
        })

    except ValueError as e:
        return jsonify({
            "success": False,
            "message": str(e),
        }), 400

    except Exception:
        app.logger.exception("PDF upload or indexing failed")

        return jsonify({
            "success": False,
            "message": (
                "Unable to process this PDF. Check the server logs "
                "for details and verify your API configuration."
            ),
        }), 500

    finally:
        # Remove the temporary PDF even if processing fails
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                app.logger.warning("Could not remove temporary PDF.")


@app.route("/ask", methods=["POST"])
def ask_question():
    """Answer a question using the active PDF's FAISS index."""
    if qa_chain is None or retriever is None:
        return jsonify({
            "success": False,
            "message": "Please upload a PDF first.",
        }), 400

    data = request.get_json(silent=True)

    if not isinstance(data, dict) or "question" not in data:
        return jsonify({
            "success": False,
            "message": "No question provided.",
        }), 400

    if not isinstance(data["question"], str):
        return jsonify({
            "success": False,
            "message": "Question must be text.",
        }), 400

    question = data["question"].strip()

    if not question:
        return jsonify({
            "success": False,
            "message": "Question cannot be empty.",
        }), 400

    try:
        answer = qa_chain.invoke(question)

        # Retrieve source pages for citations
        source_docs = retriever.invoke(question)

        pages = sorted({
            int(doc.metadata["page"]) + 1
            for doc in source_docs
            if doc.metadata.get("page") is not None
        })

        return jsonify({
            "success": True,
            "answer": answer,
            "pages": pages,
        })

    except Exception:
        app.logger.exception("Question answering failed")

        return jsonify({
            "success": False,
            "message": (
                "Unable to answer this question right now. "
                "Check the server logs for details."
            ),
        }), 500


@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "success": False,
        "message": "The PDF is too large. Maximum size is 20 MB.",
    }), 413


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))

    print(f"\nDocMind-AI running at http://127.0.0.1:{port}\n")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
    )
