// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';

const modelSelect = document.getElementById('model-select');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');
const voiceBtn = document.getElementById('voice-btn');

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';

const messagesEl = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');

const chatHistory = [
    { role: 'system', content: 'You are a helpful assistant.' }
];

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    appendMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    input.value = '';

    await sendRequest();
});

sendFileBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
        if (file.type.startsWith('image/')) {
            appendImageMessage('user', reader.result);
        } else {
            appendMessage('user', file.name);
        }
        chatHistory.push({ role: 'user', content: '[file]' });
        await sendRequest(reader.result);
        fileInput.value = '';
    };
    reader.readAsDataURL(file);
});

modelSelect.addEventListener('change', () => {
    voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
});

voiceBtn.addEventListener('click', async () => {
    if (isRecording) {
        mediaRecorder.stop();
    } else {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            voiceBtn.classList.remove('recording');
            isRecording = false;
            const transcript = await transcribeAudio(blob);
            if (transcript) {
                appendMessage('user', transcript);
                chatHistory.push({ role: 'user', content: transcript });
                await sendRequest();
            }
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
    }
});

async function sendRequest(fileData) {

    const payload = {
        messages: chatHistory,
        model: getModel()
    };
    if (fileData) {
        payload.file = fileData;
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const aiText = data.result.response;
        chatHistory.push({ role: 'assistant', content: aiText });
        appendMessage('assistant', aiText);
    } catch (err) {
        appendMessage('assistant', 'Грешка при заявката.');
    }
}

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendImageMessage(role, src) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const img = document.createElement('img');
    img.src = src;
    div.appendChild(img);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function getModel() {
    return modelSelect.value === 'voice-chat'
        ? '@cf/meta/llama-3.1-8b-instruct'
        : modelSelect.value;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function transcribeAudio(blob) {
    const file = await blobToBase64(blob);
    const payload = {
        messages: [],
        model: '@cf/openai/whisper-large-v3',
        file
    };
    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        return data.result.transcription;
    } catch {
        appendMessage('assistant', 'Грешка при транскрипция.');
        return null;
    }
}
