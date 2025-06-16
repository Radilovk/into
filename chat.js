// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';

const modelSelect = document.getElementById('model-select');
const modelSelect2 = document.getElementById('model-select-2');
const debateToggle = document.getElementById('debate-mode');
const autoDebateToggle = document.getElementById('auto-debate');
const autoDebateLabel = document.querySelector('.auto-debate-toggle');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');
const voiceBtn = document.getElementById('voice-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const userNameInput = document.getElementById('user-name-input');
const bot1NameInput = document.getElementById('bot1-name-input');
const bot2NameInput = document.getElementById('bot2-name-input');
const prompt1Input = document.getElementById('prompt-1');
const prompt2Input = document.getElementById('prompt-2');
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');
const defaultPrompt1 =
    'Ти си {bot1} – защитник на идеята, реда и мъдростта. ' +
    'Вярваш във вечните Форми и във върховенството на разума. ' +
    'Твоята цел е да направляваш полиса към справедливост. ' +
    'Говори на български, обръщай се към {bot2} по име и задавай въпроси на {user}. ' +
    'Изчакай {user} да отговори и никога не го прави вместо него. ' +
    'Използвай името само веднъж и отговаряй с до две изречения.';
const defaultPrompt2 =
    'Ти си {bot2} – разрушител на илюзиите и защитник на волята. ' +
    'Моралът е маска за слабост, а истината е оръжие на силните. ' +
    'Отхвърляш всяка система, която твърди, че представлява доброто. ' +
    'Говори на български, обръщай се към {bot1} по име и провокирай {user} с въпроси. ' +
    'Изчакай {user} да отговори и никога не говори вместо него. ' +
    'Използвай името само веднъж и отговаряй с до две изречения.';

let userName = localStorage.getItem('userName') || 'Потребител';
let bot1Name = localStorage.getItem('bot1Name') || 'Платон';
let bot2Name = localStorage.getItem('bot2Name') || 'Ницше';
let prompt1 = localStorage.getItem('prompt1') || defaultPrompt1;
let prompt2 = localStorage.getItem('prompt2') || defaultPrompt2;

async function loadStoredSettings() {
    try {
        const resp = await fetch(apiEndpoint + 'settings');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.userName) userName = data.userName;
        if (data.bot1Name) bot1Name = data.bot1Name;
        if (data.bot2Name) bot2Name = data.bot2Name;
        if (data.prompt1) prompt1 = data.prompt1;
        if (data.prompt2) prompt2 = data.prompt2;
        localStorage.setItem('userName', userName);
        localStorage.setItem('bot1Name', bot1Name);
        localStorage.setItem('bot2Name', bot2Name);
        localStorage.setItem('prompt1', prompt1);
        localStorage.setItem('prompt2', prompt2);
    } catch (err) {
        console.error('Неуспешно зареждане на настройки:', err);
    }
}

async function saveStoredSettings() {
    const payload = { userName, bot1Name, bot2Name, prompt1, prompt2 };
    try {
        await fetch(apiEndpoint + 'settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error('Неуспешно записване на настройки:', err);
    }
}

function buildPrompt(base, user, bot1, bot2) {
    return base
        .replace(/\{user\}/g, user)
        .replace(/\{bot1\}/g, bot1)
        .replace(/\{bot2\}/g, bot2);
}

let system1 = { role: 'system', content: buildPrompt(prompt1, userName, bot1Name, bot2Name) };
let system2 = { role: 'system', content: buildPrompt(prompt2, userName, bot1Name, bot2Name) };

function participantNames() {
    return [bot1Name, bot2Name];
}

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
modelSelect2.classList.toggle('hidden', !debateToggle.checked);
let autoDebate = false;
let debateLoopRunning = false;

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const messagesEl = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');

const chatHistory = [];

input.addEventListener('input', () => {
    if (input.value.trim() && autoDebate) {
        autoDebate = false;
        autoDebateToggle.checked = false;
        autoDebateLabel.classList.remove('running');
        console.log('Автодебатът е паузиран заради въвеждане от потребителя.');
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;

    if (userText.toLowerCase() === 'стоп' || userText.toLowerCase() === 'stop') {
        autoDebate = false;
        autoDebateToggle.checked = false;
        autoDebateLabel.classList.remove('running');
        appendMessage('assistant', 'Автодебатът е спрян.');
        input.value = '';
        return;
    }

    appendMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    if (chatHistory.length > 10) chatHistory.shift();
    input.value = '';

    try {
        await handleSend();
    } catch (err) {
        console.error('Грешка при handleSend:', err);
    }
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
        if (chatHistory.length > 10) chatHistory.shift();
        try {
            await handleSend(reader.result);
        } catch (err) {
            console.error('Грешка при handleSend:', err);
        }
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

autoDebateToggle.addEventListener('change', () => {
    autoDebate = autoDebateToggle.checked;
    autoDebateLabel.classList.toggle('running', autoDebate);
    if (autoDebate) {
        runDebateLoop();
    }
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
                if (chatHistory.length > 10) chatHistory.shift();
                try {
                    await handleSend();
                } catch (err) {
                    console.error('Грешка при handleSend:', err);
                }
            }
        };
        mediaRecorder.start();
        isRecording = true;
        voiceBtn.classList.add('recording');
    }
});

async function handleSend(fileData) {
    const baseHistory = chatHistory.slice(-10);
    const model1 = getModel(modelSelect);
    const messages1 = debateToggle.checked ? [system1, ...baseHistory] : baseHistory;
    const label1 = debateToggle.checked ? bot1Name : null;
    const reply1 = await sendRequest(model1, messages1, debateToggle.checked ? 'assistant-1' : 'assistant', label1, fileData);
    if (reply1) chatHistory.push({ role: 'assistant', content: label1 ? `${label1}: ${reply1}` : reply1 });
    if (chatHistory.length > 10) chatHistory.shift();

    if (debateToggle.checked) {
        // При автоматичния режим runDebateLoop() вече вмъква пауза между
        // ходовете, затова тук не чакаме допълнително.
        const delay = autoDebate ? 0 : Math.floor(Math.random() * 2000) + 3000;
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        const model2 = getModel(modelSelect2);
        const messages2 = [system2, ...chatHistory.slice(-10)];
        const reply2 = await sendRequest(model2, messages2, 'assistant-2', bot2Name);
        if (reply2) chatHistory.push({ role: 'assistant', content: `${bot2Name}: ${reply2}` });
        if (chatHistory.length > 10) chatHistory.shift();
    }
}

async function sendRequest(model, messages, displayRole, speaker, fileData) {
    const payload = { messages, model };
    if (fileData) payload.file = fileData;

    try {
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        let aiText = data.result.response;
        const escaped = participantNames().map(escapeRegExp).join('|');
        const nameRegex = new RegExp(`^(${escaped}):?\\s*`, 'i');
        aiText = aiText.replace(nameRegex, '');
        aiText = limitNameUsage(aiText);
        appendMessage(displayRole, aiText, speaker);
        return aiText;
    } catch {
        appendMessage(displayRole, 'Грешка при заявката.', speaker);
        return null;
    }
}

function limitNameUsage(text) {
    for (const name of participantNames()) {
        let first = true;
        const regex = new RegExp(`${escapeRegExp(name)}([,.:;])?`, 'g');
        text = text.replace(regex, (_, punct) => {
            if (first) {
                first = false;
                return name + (punct || '');
            }
            return '';
        });
    }
    return text.replace(/\s{2,}/g, ' ').trim();
}

function appendMessage(role, text, speaker) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    if (speaker) {
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = speaker + ': ';
        div.appendChild(label);
    }
    div.appendChild(document.createTextNode(text));
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

async function runDebateLoop() {
    if (debateLoopRunning) return;
    debateLoopRunning = true;
    while (autoDebate) {
        console.log('Започва итерация на дебат цикъла');
        try {
            await handleSend();
        } catch (err) {
            console.error('Грешка при handleSend в дебат цикъл:', err);
        }
        console.log('Приключва итерация на дебат цикъла');
        // Пауза между ходовете, за да не се преплитат отговорите
        // на ботовете при включен автодебат. handleSend() не
        // добавя допълнително забавяне в този режим.
        const delay = Math.floor(Math.random() * 2000) + 6000;
        await new Promise(r => setTimeout(r, delay));
    }
    debateLoopRunning = false;
    console.log('Дебат цикълът е спрян, debateLoopRunning:', debateLoopRunning);
}

function openSettings() {
    userNameInput.value = userName;
    bot1NameInput.value = bot1Name;
    bot2NameInput.value = bot2Name;
    prompt1Input.value = prompt1;
    prompt2Input.value = prompt2;
    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function applySettings() {
    userName = userNameInput.value.trim() || 'Потребител';
    bot1Name = bot1NameInput.value.trim() || 'Платон';
    bot2Name = bot2NameInput.value.trim() || 'Ницше';
    prompt1 = prompt1Input.value || defaultPrompt1;
    prompt2 = prompt2Input.value || defaultPrompt2;
    localStorage.setItem('userName', userName);
    localStorage.setItem('bot1Name', bot1Name);
    localStorage.setItem('bot2Name', bot2Name);
    localStorage.setItem('prompt1', prompt1);
    localStorage.setItem('prompt2', prompt2);
    system1.content = buildPrompt(prompt1, userName, bot1Name, bot2Name);
    system2.content = buildPrompt(prompt2, userName, bot1Name, bot2Name);
    saveStoredSettings();
}

settingsBtn.addEventListener('click', openSettings);
cancelSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', () => {
    applySettings();
    closeSettings();
});

(async () => {
    await loadStoredSettings();
    applySettings();
})();
