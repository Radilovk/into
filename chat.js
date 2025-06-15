// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';

const modelSelect = document.getElementById('model-select');
const modelSelect2 = document.getElementById('model-select-2');
const debateToggle = document.getElementById('debate-mode');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');
const voiceBtn = document.getElementById('voice-btn');

const system1 = { role: 'system', content: 'Ти си Бот 1. Отговаряй кратко и съдържателно, защитавайки позицията си.' };
const system2 = { role: 'system', content: 'Ти си Бот 2. Опонирай на Бот 1 и бъди също така кратък.' };

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
modelSelect2.classList.toggle('hidden', !debateToggle.checked);

const messagesEl = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');

const chatHistory = [];

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    appendMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    input.value = '';

    await handleSend();
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
        await handleSend(reader.result);
        fileInput.value = '';
    };
    reader.readAsDataURL(file);
});

modelSelect.addEventListener('change', () => {
    voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
});

debateToggle.addEventListener('change', () => {
    modelSelect2.classList.toggle('hidden', !debateToggle.checked);
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
                await handleSend();
            }
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
    }
});

async function handleSend(fileData) {
    const baseHistory = [...chatHistory];
    const model1 = getModel(modelSelect);
    const messages1 = debateToggle.checked ? [system1, ...baseHistory] : baseHistory;
    const reply1 = await sendRequest(model1, messages1, debateToggle.checked ? 'assistant-1' : 'assistant', fileData);
    if (reply1) chatHistory.push({ role: 'assistant', content: reply1 });

    if (debateToggle.checked) {
        await new Promise(r => setTimeout(r, 700));
        const model2 = getModel(modelSelect2);
        const messages2 = [system2, ...chatHistory];
        const reply2 = await sendRequest(model2, messages2, 'assistant-2');
        if (reply2) chatHistory.push({ role: 'assistant', content: reply2 });
    }
}

async function sendRequest(model, messages, displayRole, fileData) {
    const payload = { messages, model };
    if (fileData) payload.file = fileData;

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        const aiText = data.result.response;
        appendMessage(displayRole, aiText);
        return aiText;
    } catch {
        appendMessage(displayRole, 'Грешка при заявката.');
        return null;
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

function getModel(selectEl) {
    return selectEl.value === 'voice-chat'
        ? '@cf/meta/llama-3.1-8b-instruct'
        : selectEl.value;
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
