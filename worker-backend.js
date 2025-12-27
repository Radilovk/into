import { Ai } from '@cloudflare/ai';

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

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

    if (pathname.startsWith('/acuity')) {
      if (!env.ACUITY_USER || !env.ACUITY_KEY) {
        return new Response(JSON.stringify({ error: 'Missing Worker secrets' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const authHeader = `Basic ${btoa(`${env.ACUITY_USER}:${env.ACUITY_KEY}`)}`;

      // GET /acuity - list appointments
      if (pathname === '/acuity' && request.method === 'GET') {
        const url = new URL(request.url);
        const calendarID = url.searchParams.get('calendarID');
        const appointmentTypeID = url.searchParams.get('appointmentTypeID');
        if (!calendarID) {
          return new Response('Missing calendarID', { status: 400 });
        }
        const params = new URLSearchParams({ calendarID });
        if (appointmentTypeID) params.append('appointmentTypeID', appointmentTypeID);
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments?${params.toString()}`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            headers: { 'Authorization': authHeader }
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // POST /acuity - create appointment
      if (pathname === '/acuity' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // GET /acuity/clients - list clients
      if (pathname === '/acuity/clients' && request.method === 'GET') {
        const acuityUrl = `https://acuityscheduling.com/api/v1/clients`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            headers: { 'Authorization': authHeader }
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // GET /acuity/appointment-types - list appointment types
      if (pathname === '/acuity/appointment-types' && request.method === 'GET') {
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointment-types`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            headers: { 'Authorization': authHeader }
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // GET /acuity/calendars - list calendars
      if (pathname === '/acuity/calendars' && request.method === 'GET') {
        const acuityUrl = `https://acuityscheduling.com/api/v1/calendars`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            headers: { 'Authorization': authHeader }
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      // GET /acuity/availability - check availability
      if (pathname === '/acuity/availability' && request.method === 'GET') {
        const url = new URL(request.url);
        const appointmentTypeID = url.searchParams.get('appointmentTypeID');
        const month = url.searchParams.get('month');
        const calendarID = url.searchParams.get('calendarID');
        
        if (!appointmentTypeID || !month) {
          return new Response('Missing appointmentTypeID or month', { status: 400 });
        }
        
        const params = new URLSearchParams({ appointmentTypeID, month });
        if (calendarID) params.append('calendarID', calendarID);
        
        const acuityUrl = `https://acuityscheduling.com/api/v1/availability/dates?${params.toString()}`;
        let acuityResp;
        try {
          acuityResp = await fetch(acuityUrl, {
            headers: { 'Authorization': authHeader }
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
        const result = await acuityResp.text();
        return new Response(result, {
          status: acuityResp.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      return new Response('Not Found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

    const model = data.model || env.MODEL;
    const options = { ...data };
    delete options.model;

    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'Missing AI binding' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    const ai = new Ai(env.AI);
    let result;
    try {
      result = await ai.runModel(model, options);
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Request failed' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
