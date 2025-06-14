// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';
let apiToken = sessionStorage.getItem('apiToken') || '';
const tokenInput = document.getElementById('api-token');
const saveTokenBtn = document.getElementById('save-token');

tokenInput.value = apiToken;

saveTokenBtn.addEventListener('click', () => {
    apiToken = tokenInput.value.trim();
    if (apiToken) {
        sessionStorage.setItem('apiToken', apiToken);
    }
});

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

    if (!apiToken) {
        alert('Моля въведете API токен.');
        return;
    }

    appendMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    input.value = '';

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages: chatHistory })
        });
        const data = await response.json();
        const aiText = data.result.response;
        chatHistory.push({ role: 'assistant', content: aiText });
        appendMessage('assistant', aiText);
    } catch (err) {
        appendMessage('assistant', 'Грешка при заявката.');
    }
});

function appendMessage(role, text) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}
