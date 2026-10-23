
const $ = (id) => document.getElementById(id);

const fileInput = $("fileInput");
const uploadZone = $("uploadZone");
const fileSelected = $("fileSelected");
const fileName = $("fileName");
const fileSize = $("fileSize");
const removeFile = $("removeFile");
const indexBtn = $("indexBtn");
const indexBtnText = $("indexBtnText");
const indexBtnIcon = $("indexBtnIcon");
const uploadStatus = $("uploadStatus");
const chatContainer = $("chatContainer");
const questionInput = $("questionInput");
const chatForm = $("chatForm");
const sendBtn = $("sendBtn");
const emptyState = $("emptyState");
const lockedSubtitle = $("chatSubtitle");
const navLinks = $("navLinks");
const menuToggle = $("menuToggle");

let pdfIndexed = false;
let isAsking = false;
let selectedFile = null;

$("currentYear").textContent = new Date().getFullYear();

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showUploadStatus(type, message) {
    uploadStatus.hidden = false;
    uploadStatus.className = `status-message ${type}`;
    uploadStatus.textContent = message;
}

function resetChat() {
    chatContainer.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `
        <div class="empty-illustration">
            <span class="empty-page">▤</span>
            <span class="empty-sparkle">✳</span>
        </div>
        <h4>Your next insight starts here.</h4>
        <p>Ask a question about your indexed document.</p>
    `;
    emptyState.replaceWith(empty);
}

function setFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
        showUploadStatus("error", "Please select a PDF file.");
        fileInput.value = "";
        return;
    }

    selectedFile = file;
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    fileSelected.hidden = false;
    indexBtn.disabled = false;
    uploadStatus.hidden = true;
}

fileInput.addEventListener("change", () => {
    setFile(fileInput.files[0]);
});

removeFile.addEventListener("click", () => {
    selectedFile = null;
    fileInput.value = "";
    fileSelected.hidden = true;
    indexBtn.disabled = true;
    uploadStatus.hidden = true;
});

uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("drag-over");
});

uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("drag-over");
});

uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("drag-over");

    const file = event.dataTransfer.files[0];
    if (!file) return;

    setFile(file);
});

// Index the selected PDF through the existing Flask endpoint.
indexBtn.addEventListener("click", async () => {
    if (!selectedFile) return;

    indexBtn.disabled = true;
    indexBtnText.textContent = "Indexing document...";
    indexBtnIcon.textContent = "…";
    showUploadStatus("loading", "Preparing your PDF. The first indexing may take a little longer.");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Could not index the PDF.");
        }

        pdfIndexed = true;
        showUploadStatus("success", data.message || "PDF indexed successfully!");

        indexBtnText.textContent = "Document indexed";
        indexBtnIcon.textContent = "✓";

        questionInput.disabled = false;
        sendBtn.disabled = false;
        $("chatSubtitle").textContent = `Ready to answer questions about ${selectedFile.name}.`;

        document.querySelectorAll(".suggestion").forEach((button) => {
            button.disabled = false;
        });

        const overlay = $("lockedOverlay");
        if (overlay) overlay.classList.add("hidden");

        // Show a clean chat for the newly indexed document.
        chatContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-illustration">
                    <span class="empty-page">▤</span>
                    <span class="empty-sparkle">✳</span>
                </div>
                <h4>Your document is ready.</h4>
                <p>Ask a question to explore its content.</p>
            </div>
        `;

        questionInput.focus();
    } catch (error) {
        pdfIndexed = false;
        showUploadStatus("error", error.message);
        indexBtn.disabled = false;
        indexBtnText.textContent = "Retry indexing";
        indexBtnIcon.textContent = "↻";
    }
});

function addMessage(role, text, pages = []) {
    const wrapper = document.createElement("div");
    wrapper.className = "message";

    if (role === "user") {
        const row = document.createElement("div");
        row.className = "msg-user";

        const bubble = document.createElement("div");
        bubble.className = "bubble";
        bubble.textContent = text;

        row.appendChild(bubble);
        wrapper.appendChild(row);
    } else {
        const row = document.createElement("div");
        row.className = "msg-bot";

        const avatar = document.createElement("div");
        avatar.className = "bot-avatar";
        avatar.textContent = "✳";

        const content = document.createElement("div");
        content.className = "bubble";
        content.textContent = text;

        if (pages.length) {
            const source = document.createElement("div");
            source.className = "source-tag";
            source.textContent = `Source pages: ${pages.join(", ")}`;
            content.appendChild(source);
        }

        row.append(avatar, content);
        wrapper.appendChild(row);
    }

    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return wrapper;
}

function addTypingIndicator() {
    const wrapper = document.createElement("div");
    wrapper.className = "message";

    const row = document.createElement("div");
    row.className = "msg-bot";

    const avatar = document.createElement("div");
    avatar.className = "bot-avatar";
    avatar.textContent = "✳";

    const bubble = document.createElement("div");
    bubble.className = "bubble";

    const dots = document.createElement("div");
    dots.className = "typing-dots";

    for (let i = 0; i < 3; i++) {
        dots.appendChild(document.createElement("span"));
    }

    bubble.appendChild(dots);
    row.append(avatar, bubble);
    wrapper.appendChild(row);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return wrapper;
}

chatForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = questionInput.value.trim();
    if (!question || isAsking || !pdfIndexed) return;

    isAsking = true;
    sendBtn.disabled = true;
    questionInput.disabled = true;

    // Remove the empty-state placeholder.
    chatContainer.querySelector(".empty-state")?.remove();

    addMessage("user", question);
    questionInput.value = "";
    questionInput.style.height = "auto";

    const typing = addTypingIndicator();

    try {
        const response = await fetch("/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question })
        });

        const data = await response.json();
        typing.remove();

        if (!response.ok || !data.success) {
            addMessage("bot", data.message || "Sorry, something went wrong.");
        } else {
            addMessage("bot", data.answer, data.pages || []);
        }
    } catch (error) {
        typing.remove();
        addMessage("bot", `Unable to reach the server: ${error.message}`);
    } finally {
        isAsking = false;
        sendBtn.disabled = !pdfIndexed;
        questionInput.disabled = !pdfIndexed;
        questionInput.focus();
    }
});

questionInput.addEventListener("input", () => {
    questionInput.style.height = "auto";
    questionInput.style.height = `${Math.min(questionInput.scrollHeight, 130)}px`;
});

document.querySelectorAll(".suggestion").forEach((button) => {
    button.disabled = false;

    button.addEventListener("click", () => {
        if (!pdfIndexed) {
            showUploadStatus("loading", "Upload and index a PDF before asking questions.");
            $("workspace").scrollIntoView({ behavior: "smooth" });
            return;
        }

        questionInput.value = button.dataset.question;
        questionInput.focus();
        questionInput.dispatchEvent(new Event("input"));
    });
});

// Responsive navigation.
menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Close navigation menu" : "Open navigation menu"
    );
});

navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation menu");
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Open navigation menu");
    }
});

// Support Shift+Enter for a new line and Enter to submit.
questionInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        chatForm.requestSubmit();
    }
});
