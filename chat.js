// URL на бекенда, който препраща заявките към Cloudflare Workers AI
// Чат страницата използва worker, достъпен на този адрес
const apiEndpoint = 'https://workerai.radilov-k.workers.dev/';

const modelSelect = document.getElementById('model-select');
const modelSelect2 = document.getElementById('model-select-2');
const modelDesc1 = document.getElementById('model-desc-1');
const modelDesc2 = document.getElementById('model-desc-2');
const debateToggle = document.getElementById('debate-mode');
const autoDebateToggle = document.getElementById('auto-debate');
const autoDebateLabel = document.querySelector('.auto-debate-toggle');
const pauseBtn = document.getElementById('pause-btn');
const fileInput = document.getElementById('file-input');
const sendFileBtn = document.getElementById('send-file');
const voiceBtn = document.getElementById('voice-btn');
const themeToggle = document.querySelector('.theme-toggle');
const body = document.body;
const themeIcon = themeToggle.querySelector('i');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const userNameInput = document.getElementById('user-name-input');
const bot1NameInput = document.getElementById('bot1-name-input');
const bot2NameInput = document.getElementById('bot2-name-input');
const commonPromptInput = document.getElementById('common-prompt');
const prompt1Input = document.getElementById('prompt-1');
const prompt2Input = document.getElementById('prompt-2');
const length1Input = document.getElementById('length-1');
const temp1Input = document.getElementById('temp-1');
const length2Input = document.getElementById('length-2');
const temp2Input = document.getElementById('temp-2');
const humorInput = document.getElementById('humor-level');
const sarcasmInput = document.getElementById('sarcasm-level');
const aggressionInput = document.getElementById('aggression-level');
const delayInput = document.getElementById('delay-level');

const length1Value = length1Input.nextElementSibling;
const temp1Value = temp1Input.nextElementSibling;
const length2Value = length2Input.nextElementSibling;
const temp2Value = temp2Input.nextElementSibling;
const humorValue = humorInput.nextElementSibling;
const sarcasmValue = sarcasmInput.nextElementSibling;
const aggressionValue = aggressionInput.nextElementSibling;
const delayValue = delayInput.nextElementSibling;
const saveSettingsBtn = document.getElementById('save-settings');
const cancelSettingsBtn = document.getElementById('cancel-settings');

// Настройки на темата
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    body.classList.add(savedTheme);
    updateThemeIcon();
}

themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    if (body.classList.contains('dark-theme')) {
        localStorage.setItem('theme', 'dark-theme');
    } else {
        localStorage.removeItem('theme');
    }
    updateThemeIcon();
});

function updateThemeIcon() {
    if (body.classList.contains('dark-theme')) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
}
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
const defaultCommonPrompt = '';

let userName = localStorage.getItem('userName') || 'Потребител';
let bot1Name = localStorage.getItem('bot1Name') || 'Платон';
let bot2Name = localStorage.getItem('bot2Name') || 'Ницше';
let commonPrompt = localStorage.getItem('commonPrompt') || defaultCommonPrompt;
let prompt1 = localStorage.getItem('prompt1') || defaultPrompt1;
let prompt2 = localStorage.getItem('prompt2') || defaultPrompt2;
let length1 = parseInt(localStorage.getItem('length1')) || 60;
let temp1 = parseFloat(localStorage.getItem('temp1')) || 0.7;
let length2 = parseInt(localStorage.getItem('length2')) || 60;
let temp2 = parseFloat(localStorage.getItem('temp2')) || 0.7;
let humorLevel = parseInt(localStorage.getItem('humorLevel')) || 0;
let sarcasmLevel = parseInt(localStorage.getItem('sarcasmLevel')) || 0;
let aggressionLevel = parseInt(localStorage.getItem('aggressionLevel')) || 0;
let delayLevel = parseInt(localStorage.getItem('delayLevel')) || 3;

async function loadStoredSettings() {
    try {
        const resp = await fetch(apiEndpoint + 'settings');
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.userName) userName = data.userName;
        if (data.bot1Name) bot1Name = data.bot1Name;
        if (data.bot2Name) bot2Name = data.bot2Name;
        if (data.commonPrompt) commonPrompt = data.commonPrompt;
        if (data.prompt1) prompt1 = data.prompt1;
        if (data.prompt2) prompt2 = data.prompt2;
        if (data.length1) length1 = parseInt(data.length1);
        if (data.temp1) temp1 = parseFloat(data.temp1);
        if (data.length2) length2 = parseInt(data.length2);
        if (data.temp2) temp2 = parseFloat(data.temp2);
        if (data.humorLevel) humorLevel = parseInt(data.humorLevel);
        if (data.sarcasmLevel) sarcasmLevel = parseInt(data.sarcasmLevel);
        if (data.aggressionLevel) aggressionLevel = parseInt(data.aggressionLevel);
        if (data.delayLevel) delayLevel = parseInt(data.delayLevel);
        localStorage.setItem('userName', userName);
        localStorage.setItem('bot1Name', bot1Name);
        localStorage.setItem('bot2Name', bot2Name);
        localStorage.setItem('commonPrompt', commonPrompt);
        localStorage.setItem('prompt1', prompt1);
        localStorage.setItem('prompt2', prompt2);
        localStorage.setItem('length1', length1);
        localStorage.setItem('temp1', temp1);
        localStorage.setItem('length2', length2);
        localStorage.setItem('temp2', temp2);
        localStorage.setItem('humorLevel', humorLevel);
        localStorage.setItem('sarcasmLevel', sarcasmLevel);
        localStorage.setItem('aggressionLevel', aggressionLevel);
        localStorage.setItem('delayLevel', delayLevel);
    } catch (err) {
        console.error('Неуспешно зареждане на настройки:', err);
    }
}

async function saveStoredSettings() {
    const payload = { userName, bot1Name, bot2Name, commonPrompt, prompt1, prompt2, length1, temp1, length2, temp2, humorLevel, sarcasmLevel, aggressionLevel, delayLevel };
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

function buildPrompt(base, user, bot1, bot2, humor, sarcasm, aggression) {
    let text = base
        .replace(/\{user\}/g, user)
        .replace(/\{bot1\}/g, bot1)
        .replace(/\{bot2\}/g, bot2);
    text += `\nХумор: ${humor}/10. Сарказъм: ${sarcasm}/10. Агресия: ${aggression}/10.`;
    return text;
}

let system1 = { role: 'system', content: buildPrompt((commonPrompt ? commonPrompt + '\n' : '') + prompt1, userName, bot1Name, bot2Name, humorLevel, sarcasmLevel, aggressionLevel) };
let system2 = { role: 'system', content: buildPrompt((commonPrompt ? commonPrompt + '\n' : '') + prompt2, userName, bot1Name, bot2Name, humorLevel, sarcasmLevel, aggressionLevel) };

function updateSystemPrompts() {
    system1.content = buildPrompt((commonPrompt ? commonPrompt + '\n' : '') + prompt1,
        userName, bot1Name, bot2Name, humorLevel, sarcasmLevel, aggressionLevel);
    system2.content = buildPrompt((commonPrompt ? commonPrompt + '\n' : '') + prompt2,
        userName, bot1Name, bot2Name, humorLevel, sarcasmLevel, aggressionLevel);
}

function updateSliderDisplays() {
    length1Value.textContent = length1Input.value;
    temp1Value.textContent = temp1Input.value;
    length2Value.textContent = length2Input.value;
    temp2Value.textContent = temp2Input.value;
    humorValue.textContent = humorInput.value;
    sarcasmValue.textContent = sarcasmInput.value;
    aggressionValue.textContent = aggressionInput.value;
    delayValue.textContent = delayInput.value;
}

function participantNames() {
    return [bot1Name, bot2Name];
}

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
modelSelect2.classList.toggle('hidden', !debateToggle.checked);
let autoDebate = false;
let isPaused = false;
let debateLoopRunning = false;

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const messagesEl = document.getElementById('messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const clearChatBtn = document.getElementById('clear-chat');

const chatHistory = [];

input.addEventListener('input', () => {
    if (input.value.trim() && autoDebate) {
        autoDebate = false;
        isPaused = false;
        pauseBtn.classList.add('hidden');
        pauseBtn.textContent = 'Пауза';
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
        isPaused = false;
        pauseBtn.classList.add('hidden');
        pauseBtn.textContent = 'Пауза';
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
    updateDescription(modelSelect, modelDesc1);
});

modelSelect2.addEventListener('change', () => {
    updateDescription(modelSelect2, modelDesc2);
});

debateToggle.addEventListener('change', () => {
    modelSelect2.classList.toggle('hidden', !debateToggle.checked);
    modelDesc2.classList.toggle('hidden', !debateToggle.checked);
});

autoDebateToggle.addEventListener('change', () => {
    autoDebate = autoDebateToggle.checked;
    isPaused = false;
    pauseBtn.textContent = 'Пауза';
    pauseBtn.classList.toggle('hidden', !autoDebate);
    autoDebateLabel.classList.toggle('running', autoDebate);
    if (autoDebate) {
        runDebateLoop();
    }
});

pauseBtn.addEventListener('click', () => {
    if (!isPaused) {
        isPaused = true;
        pauseBtn.textContent = 'Продължи';
        autoDebateLabel.classList.remove('running');
    } else {
        isPaused = false;
        pauseBtn.textContent = 'Пауза';
        autoDebateLabel.classList.add('running');
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
    const reply1 = await sendRequest(model1, messages1, debateToggle.checked ? 'assistant-1' : 'assistant', label1, fileData, temp1, length1);
    if (reply1) chatHistory.push({ role: 'assistant', content: label1 ? `${label1}: ${reply1}` : reply1 });
    if (chatHistory.length > 10) chatHistory.shift();

    if (debateToggle.checked) {
        // При автоматичния режим runDebateLoop() вече вмъква пауза между
        // ходовете, затова тук не чакаме допълнително.
        const delay = autoDebate ? 0 : delayLevel * 1000;
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        const model2 = getModel(modelSelect2);
        const messages2 = [system2, ...chatHistory.slice(-10)];
        const reply2 = await sendRequest(model2, messages2, 'assistant-2', bot2Name, null, temp2, length2);
        if (reply2) chatHistory.push({ role: 'assistant', content: `${bot2Name}: ${reply2}` });
        if (chatHistory.length > 10) chatHistory.shift();
    }
}

async function sendRequest(model, messages, displayRole, speaker, fileData, temp, maxTokens) {
    const payload = { messages, model };
    if (temp !== undefined) payload.temperature = temp;
    if (maxTokens !== undefined) payload.max_tokens = maxTokens;
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

function updateDescription(selectEl, descEl) {
    const option = selectEl.selectedOptions[0];
    descEl.textContent = option ? option.dataset.desc || '' : '';
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
    while (autoDebate && !isPaused) {
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
        const delay = delayLevel * 1000;
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
    debateLoopRunning = false;
    console.log('Дебат цикълът е спрян, debateLoopRunning:', debateLoopRunning);
}

function clearChat() {
    messagesEl.innerHTML = '';
    chatHistory.length = 0;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

function openSettings() {
    userNameInput.value = userName;
    bot1NameInput.value = bot1Name;
    bot2NameInput.value = bot2Name;
    commonPromptInput.value = commonPrompt;
    prompt1Input.value = prompt1;
    prompt2Input.value = prompt2;
    length1Input.value = length1;
    temp1Input.value = temp1;
    length2Input.value = length2;
    temp2Input.value = temp2;
    humorInput.value = humorLevel;
    sarcasmInput.value = sarcasmLevel;
    aggressionInput.value = aggressionLevel;
    delayInput.value = delayLevel;
    updateSliderDisplays();
    settingsModal.classList.remove('hidden');
}

function closeSettings() {
    settingsModal.classList.add('hidden');
}

function applySettings() {
    userName = userNameInput.value.trim() || 'Потребител';
    bot1Name = bot1NameInput.value.trim() || 'Платон';
    bot2Name = bot2NameInput.value.trim() || 'Ницше';
    commonPrompt = commonPromptInput.value || defaultCommonPrompt;
    prompt1 = prompt1Input.value || defaultPrompt1;
    prompt2 = prompt2Input.value || defaultPrompt2;
    localStorage.setItem('userName', userName);
    localStorage.setItem('bot1Name', bot1Name);
    localStorage.setItem('bot2Name', bot2Name);
    localStorage.setItem('commonPrompt', commonPrompt);
    localStorage.setItem('prompt1', prompt1);
    localStorage.setItem('prompt2', prompt2);
    localStorage.setItem('length1', length1Input.value);
    localStorage.setItem('temp1', temp1Input.value);
    localStorage.setItem('length2', length2Input.value);
    localStorage.setItem('temp2', temp2Input.value);
    localStorage.setItem('humorLevel', humorInput.value);
    localStorage.setItem('sarcasmLevel', sarcasmInput.value);
    localStorage.setItem('aggressionLevel', aggressionInput.value);
    localStorage.setItem('delayLevel', delayInput.value);
    length1 = parseInt(length1Input.value);
    temp1 = parseFloat(temp1Input.value);
    length2 = parseInt(length2Input.value);
    temp2 = parseFloat(temp2Input.value);
    humorLevel = parseInt(humorInput.value);
    sarcasmLevel = parseInt(sarcasmInput.value);
    aggressionLevel = parseInt(aggressionInput.value);
    delayLevel = parseInt(delayInput.value);
    updateSystemPrompts();
    updateSliderDisplays();
    saveStoredSettings();
    showToast('Настройките са запазени');
}

settingsBtn.addEventListener('click', openSettings);
cancelSettingsBtn.addEventListener('click', closeSettings);
saveSettingsBtn.addEventListener('click', () => {
    applySettings();
    closeSettings();
});

length1Input.addEventListener('input', () => {
    length1 = parseInt(length1Input.value);
    length1Value.textContent = length1Input.value;
    updateSystemPrompts();
});

temp1Input.addEventListener('input', () => {
    temp1 = parseFloat(temp1Input.value);
    temp1Value.textContent = temp1Input.value;
    updateSystemPrompts();
});

length2Input.addEventListener('input', () => {
    length2 = parseInt(length2Input.value);
    length2Value.textContent = length2Input.value;
    updateSystemPrompts();
});

temp2Input.addEventListener('input', () => {
    temp2 = parseFloat(temp2Input.value);
    temp2Value.textContent = temp2Input.value;
    updateSystemPrompts();
});

humorInput.addEventListener('input', () => {
    humorLevel = parseInt(humorInput.value);
    humorValue.textContent = humorInput.value;
    updateSystemPrompts();
});

sarcasmInput.addEventListener('input', () => {
    sarcasmLevel = parseInt(sarcasmInput.value);
    sarcasmValue.textContent = sarcasmInput.value;
    updateSystemPrompts();
});

aggressionInput.addEventListener('input', () => {
    aggressionLevel = parseInt(aggressionInput.value);
    aggressionValue.textContent = aggressionInput.value;
    updateSystemPrompts();
});

delayInput.addEventListener('input', () => {
    delayLevel = parseInt(delayInput.value);
    delayValue.textContent = delayInput.value;
    updateSystemPrompts();
});
clearChatBtn.addEventListener('click', () => {
    if (confirm('Да изчистя ли историята на чата?')) {
        clearChat();
    }
});

(async () => {
    await loadStoredSettings();
    // Попълване на формата с заредените стойности
    userNameInput.value = userName;
    bot1NameInput.value = bot1Name;
    bot2NameInput.value = bot2Name;
    commonPromptInput.value = commonPrompt;
    prompt1Input.value = prompt1;
    prompt2Input.value = prompt2;
    length1Input.value = length1;
    temp1Input.value = temp1;
    length2Input.value = length2;
    temp2Input.value = temp2;
    humorInput.value = humorLevel;
    sarcasmInput.value = sarcasmLevel;
    aggressionInput.value = aggressionLevel;
    delayInput.value = delayLevel;
    applySettings();
    updateSliderDisplays();
    updateDescription(modelSelect, modelDesc1);
    updateDescription(modelSelect2, modelDesc2);
})();
