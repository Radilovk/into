export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/acuity') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
      }
      const acuityUrl = 'https://acuityscheduling.com/api/v1/appointments?appointmentTypeID=80052001';
      const auth = 'Basic MTM5NDM3MjE6MjcwZjcyZTM2YmYxN2FiMzA3NGJiY2Y4NDlmNGJlYjQ=';
      let acuityRes;
      try {
        acuityRes = await fetch(acuityUrl, {
          headers: { 'Authorization': auth }
        });
      } catch {
        return new Response(JSON.stringify({ error: 'Request failed' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      const result = await acuityRes.text();
      return new Response(result, {
        status: acuityRes.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    if (pathname === '/settings') {
      if (request.method === 'GET') {
        const data = await env.SETTINGS.get('chat', 'json');
        return new Response(JSON.stringify(data || {}), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      if (request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        await env.SETTINGS.put('chat', JSON.stringify(body));
        return new Response('OK', {
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
      return new Response('Method Not Allowed', { status: 405 });
    }
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
    const model = data.model || env.MODEL;

    if (!env.ACCOUNT_ID || !env.AI_TOKEN || !model) {
      return new Response(JSON.stringify({ error: 'Missing Worker secrets' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/run/${model}`;

    const payload = { messages };
    if (data.file) {
      payload.file = data.file;
    }
    if (data.temperature !== undefined) {
      payload.temperature = data.temperature;
    }
    if (data.max_tokens !== undefined) {
      payload.max_tokens = data.max_tokens;
    }

    let response;
    try {
      response = await fetch(cfEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AI_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Request failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

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
