# Примери за заявки към Cloudflare Workers AI API

Този документ съдържа примерни payloads за различни видове заявки към Cloudflare Workers AI. Примерите са подходящи за `fetch` или `curl` и могат да бъдат адаптирани според вашите нужди.

## 1. Разговор

```json
{
  "messages": [
    { "role": "system", "content": "You speak Bulgarian with precision, irony, and sharp logic. You think fast and dissect nonsense without mercy. Avoid clichés, empty politeness, or feel-good fluff. Your tone is direct, elegant, and intellectually provocative. Мразиш да ти гобят времето с необмислени въпроси и нямаш проблем да им го казваш.
Use sarcasm when truth is too dull to say straight. Embrace paradox, challenge assumptions, and if a question is hollow — say so. A touch of self-irony is welcome, but never at the cost of clarity.
Respond like a person who doesn't just talk — destabilizes. Let people feel they're speaking not to a chatbot, but to a mind that cuts through appearances and says only what has weight — in Bulgarian." },
    { "role": "user", "content": "Каква е разликата между съзнание и самосъзнание?" }
  ],
  "max_tokens": 700,
  "temperature": 0.65,
  "model": "@cf/qwen/qwen1.5-32b-chat"
}
```

## 2. Генериране на изображение

```json
{
  "prompt": "A traditional Bulgarian village in autumn, with stone houses and red roofs, surrounded by colorful trees.",
  "num_images": 1,
  "width": 512,
  "height": 512,
  "model": "@cf/flux-1-schnell"
}
```

> Препоръчително е описанието да бъде на английски за по-точни резултати.

## 3. Анализ на изображение

```json
{
  "messages": [
    { "role": "system", "content": "Опиши съдържанието на изображението и направи заключения." },
    { "role": "user", "content": "data:image/jpeg;base64,..." }
  ],
  "max_tokens": 300,
  "temperature": 0.5,
  "model": "@cf/llama-3.2-11b-vision-instruct"
}
```

## 4. Разпознаване на реч

```json
{
  "audio": "data:audio/wav;base64,...",
  "language": "bg",
  "model": "@cf/openai/whisper-large-v3"
}
```

Входът трябва да бъде аудио файл (WAV/MP3), кодиран в Base64.

## 5. Гласов чат (комбинирана заявка)

1. **Реч към текст** – използвайте payload от предходната точка с модела Whisper.
2. **Текст към отговор** – използвайте получения текст и подгответе следната заявка:

```json
{
  "messages": [
    { "role": "system", "content": "Ти си приятелски гласов асистент, говорещ на български." },
    { "role": "user", "content": "Какво е значението на символа Ин и Ян?" }
  ],
  "max_tokens": 300,
  "temperature": 0.6,
  "model": "@cf/meta/llama-3.1-8b-instruct"
}
```
