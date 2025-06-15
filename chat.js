// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';
let apiToken = sessionStorage.getItem('apiToken') || '';

function ensureToken() {
    if (!apiToken) {
        apiToken = prompt('Въведете API токен за Workers AI:');
        if (apiToken) {
            sessionStorage.setItem('apiToken', apiToken);
        }
    }
}

const modelSelect = document.getElementById('model-select');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');

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
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
        appendMessage('user', '[файл]');
        chatHistory.push({ role: 'user', content: '[file]' });
        await sendRequest(reader.result);
    };
    reader.readAsDataURL(file);
});

async function sendRequest(fileData) {
    ensureToken();
    if (!apiToken) {
        alert('Липсва API токен.');
        return;
    }

    const payload = {
        messages: chatHistory,
        model: modelSelect.value
    };
    if (fileData) {
        payload.file = fileData;
    }

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
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
