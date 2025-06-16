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
const closeSettingsBtn = document.getElementById('close-settings');

const system1 = {
    role: 'system',
    content:
        'Ти си Платон – защитник на идеята, реда и мъдростта. ' +
        'Вярваш във вечните Форми и във върховенството на разума. ' +
        'Твоята цел е да направляваш полиса към справедливост. ' +
        'Говори на български, обръщай се към Ницше по име и задавай въпроси на потребителя. ' +
        'Използвай името само веднъж и отговаряй с до две изречения.'
};
const system2 = {
    role: 'system',
    content:
        'Ти си Ницше – разрушител на илюзиите и защитник на волята. ' +
        'Моралът е маска за слабост, а истината е оръжие на силните. ' +
        'Отхвърляш всяка система, която твърди, че представлява доброто. ' +
        'Говори на български, обръщай се към Платон по име и провокирай потребителя с въпроси. ' +
        'Използвай името само веднъж и отговаряй с до две изречения.'
};

let isRecording = false;
let mediaRecorder;
let audioChunks = [];
voiceBtn.style.display = modelSelect.value === 'voice-chat' ? 'block' : 'none';
modelSelect2.classList.toggle('hidden', !debateToggle.checked);
let autoDebate = false;
let debateLoopRunning = false;

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
    const baseHistory = [...chatHistory];
    const model1 = getModel(modelSelect);
    const messages1 = debateToggle.checked ? [system1, ...baseHistory] : baseHistory;
    const label1 = debateToggle.checked ? 'Платон' : null;
    const reply1 = await sendRequest(model1, messages1, debateToggle.checked ? 'assistant-1' : 'assistant', label1, fileData);
    if (reply1) chatHistory.push({ role: 'assistant', content: label1 ? `${label1}: ${reply1}` : reply1 });

    if (debateToggle.checked) {
        // При автоматичния режим runDebateLoop() вече вмъква пауза между
        // ходовете, затова тук не чакаме допълнително.
        const delay = autoDebate ? 0 : Math.floor(Math.random() * 2000) + 3000;
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        const model2 = getModel(modelSelect2);
        const messages2 = [system2, ...chatHistory];
        const reply2 = await sendRequest(model2, messages2, 'assistant-2', 'Ницше');
        if (reply2) chatHistory.push({ role: 'assistant', content: `Ницше: ${reply2}` });
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
        aiText = aiText.replace(/^(Платон:|Ницше:)\s*/i, '');
        aiText = limitNameUsage(aiText);
        appendMessage(displayRole, aiText, speaker);
        return aiText;
    } catch {
        appendMessage(displayRole, 'Грешка при заявката.', speaker);
        return null;
    }
}

function limitNameUsage(text) {
    for (const name of ['Платон', 'Ницше']) {
        let first = true;
        const regex = new RegExp(`${name}([,.:;])?`, 'g');
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
        const delay = Math.floor(Math.random() * 2000) + 3000;
        await new Promise(r => setTimeout(r, delay));
    }
    debateLoopRunning = false;
    console.log('Дебат цикълът е спрян, debateLoopRunning:', debateLoopRunning);
}

// Настройки - отваряне и затваряне на модала
if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
    });

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
            settingsModal.classList.add('hidden');
        }
    });

    settingsModal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
            settingsModal.classList.add('hidden');
        }
    });
}
