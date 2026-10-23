
# 🤖 RAG PDF Chatbot

A PDF question-answering chatbot built with **Retrieval-Augmented Generation (RAG)**. Upload a PDF, ask questions, and get answers with source page references.

## ✨ Features

- Upload and process text-based PDF files
- Split documents into searchable text chunks
- Generate embeddings using Hugging Face
- Retrieve relevant content using FAISS
- Generate answers using the Groq API
- Display answers with source page numbers
- Responsive web interface built with HTML, CSS, and JavaScript

## 🛠️ Tech Stack

- **Backend:** Python, Flask
- **RAG Framework:** LangChain
- **Embeddings:** `all-MiniLM-L6-v2`
- **Vector Database:** FAISS
- **LLM:** Groq API
- **PDF Processing:** PyPDFLoader
- **Frontend:** HTML, CSS, JavaScript

## 🚀 Getting Started

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure your Groq API key

Get an API key from [Groq Console](https://console.groq.com/keys).

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_api_key_here
```

**Never upload your `.env` file or API key to GitHub.**

### 3. Run the application

```bash
python app.py
```

Open http://127.0.0.1:7860 in your browser.

## 📖 How to Use

1. Upload a text-based PDF.
2. Click **Index PDF** and wait for processing.
3. Ask a question about the document.
4. Read the answer and its source page references.

## ⚠️ Limitations

- Works best with PDFs containing selectable text.
- Scanned PDFs and images may not be processed accurately without OCR.
- Answers depend on the information retrieved from the document.
- Only the currently indexed document is supported at a time.

## 📁 Project Structure

```text
rag-pdf-chatbot/
├── app.py
├── rag_engine.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
└── static/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── app.js
```

## 📄 License

This project is licensed under the MIT License.
