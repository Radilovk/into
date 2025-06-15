export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let data;
    try {
      data = await request.json();
    } catch (err) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const messages = data.messages || [];
    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${env.MODEL}`;

    const response = await fetch(cfEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.AI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ messages })
    });

    const result = await response.text();
    return new Response(result, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
