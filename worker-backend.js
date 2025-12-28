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
      
      // Helper function for Acuity API calls
      const callAcuityAPI = async (url, options = {}) => {
        try {
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options.headers,
              'Authorization': authHeader
            }
          });
          const result = await response.text();
          return new Response(result, {
            status: response.status,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
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
      };

      // Handle OPTIONS preflight requests for CORS
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type'
          }
        });
      }

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
        return callAcuityAPI(acuityUrl);
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
        return callAcuityAPI(acuityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // GET /acuity/clients - list clients
      if (pathname === '/acuity/clients' && request.method === 'GET') {
        return callAcuityAPI('https://acuityscheduling.com/api/v1/clients');
      }

      // GET /acuity/appointment-types - list appointment types
      if (pathname === '/acuity/appointment-types' && request.method === 'GET') {
        return callAcuityAPI('https://acuityscheduling.com/api/v1/appointment-types');
      }

      // PUT/PATCH /acuity/appointment-types/:id - update appointment type
      if (pathname.match(/^\/acuity\/appointment-types\/\d+$/) && (request.method === 'PUT' || request.method === 'PATCH')) {
        const typeId = pathname.split('/').pop();
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointment-types/${typeId}`;
        return callAcuityAPI(acuityUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // GET /acuity/calendars - list calendars
      if (pathname === '/acuity/calendars' && request.method === 'GET') {
        return callAcuityAPI('https://acuityscheduling.com/api/v1/calendars');
      }

      // GET /acuity/availability - check availability (dates only)
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
        return callAcuityAPI(acuityUrl);
      }

      // GET /acuity/availability/times - check available time slots
      if (pathname === '/acuity/availability/times' && request.method === 'GET') {
        const url = new URL(request.url);
        const appointmentTypeID = url.searchParams.get('appointmentTypeID');
        const date = url.searchParams.get('date');
        const calendarID = url.searchParams.get('calendarID');
        
        if (!appointmentTypeID || !date) {
          return new Response('Missing appointmentTypeID or date', { status: 400 });
        }
        
        const params = new URLSearchParams({ appointmentTypeID, date });
        if (calendarID) params.append('calendarID', calendarID);
        
        const acuityUrl = `https://acuityscheduling.com/api/v1/availability/times?${params.toString()}`;
        return callAcuityAPI(acuityUrl);
      }

      // PUT/PATCH /acuity/appointments/:id - update appointment
      if (pathname.match(/^\/acuity\/appointments\/\d+$/) && (request.method === 'PUT' || request.method === 'PATCH')) {
        const appointmentId = pathname.split('/').pop();
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`;
        return callAcuityAPI(acuityUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // PUT /acuity/appointments/:id/cancel - cancel appointment
      if (pathname.match(/^\/acuity\/appointments\/\d+\/cancel$/) && request.method === 'PUT') {
        const pathParts = pathname.split('/');
        const appointmentId = pathParts[pathParts.length - 2]; // Get ID before 'cancel'
        let body = {};
        try {
          body = await request.json();
        } catch {
          // Optional body for cancel reason
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments/${appointmentId}/cancel`;
        return callAcuityAPI(acuityUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // PUT/PATCH /acuity/calendars/:id - update calendar
      if (pathname.match(/^\/acuity\/calendars\/\d+$/) && (request.method === 'PUT' || request.method === 'PATCH')) {
        const calendarId = pathname.split('/').pop();
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/calendars/${calendarId}`;
        return callAcuityAPI(acuityUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // GET /acuity/blocks - get availability blocks
      if (pathname === '/acuity/blocks' && request.method === 'GET') {
        const url = new URL(request.url);
        const calendarID = url.searchParams.get('calendarID');
        const params = new URLSearchParams();
        if (calendarID) params.append('calendarID', calendarID);
        const acuityUrl = `https://acuityscheduling.com/api/v1/blocks${params.toString() ? '?' + params.toString() : ''}`;
        return callAcuityAPI(acuityUrl);
      }

      // POST /acuity/blocks - create availability block
      if (pathname === '/acuity/blocks' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/blocks`;
        return callAcuityAPI(acuityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // DELETE /acuity/blocks/:id - delete availability block
      if (pathname.match(/^\/acuity\/blocks\/\d+$/) && request.method === 'DELETE') {
        const blockId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/blocks/${blockId}`;
        return callAcuityAPI(acuityUrl, { method: 'DELETE' });
      }

      // PUT/PATCH /acuity/clients/:id - update client
      if (pathname.match(/^\/acuity\/clients\/\d+$/) && (request.method === 'PUT' || request.method === 'PATCH')) {
        const clientId = pathname.split('/').pop();
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/clients/${clientId}`;
        return callAcuityAPI(acuityUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // DELETE /acuity/clients/:id - delete client
      if (pathname.match(/^\/acuity\/clients\/\d+$/) && request.method === 'DELETE') {
        const clientId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/clients/${clientId}`;
        return callAcuityAPI(acuityUrl, { method: 'DELETE' });
      }

      // GET /acuity/business-info - get business information
      if (pathname === '/acuity/business-info' && request.method === 'GET') {
        return callAcuityAPI('https://acuityscheduling.com/api/v1/business-info');
      }

      // POST /acuity/appointment-types - create appointment type (service)
      if (pathname === '/acuity/appointment-types' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointment-types`;
        return callAcuityAPI(acuityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // DELETE /acuity/appointment-types/:id - delete appointment type (service)
      if (pathname.match(/^\/acuity\/appointment-types\/\d+$/) && request.method === 'DELETE') {
        const typeId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointment-types/${typeId}`;
        return callAcuityAPI(acuityUrl, { method: 'DELETE' });
      }

      // GET /acuity/appointment-types/:id - get single appointment type
      if (pathname.match(/^\/acuity\/appointment-types\/\d+$/) && request.method === 'GET') {
        const typeId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointment-types/${typeId}`;
        return callAcuityAPI(acuityUrl);
      }

      // POST /acuity/calendars - create calendar
      if (pathname === '/acuity/calendars' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/calendars`;
        return callAcuityAPI(acuityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // DELETE /acuity/calendars/:id - delete calendar
      if (pathname.match(/^\/acuity\/calendars\/\d+$/) && request.method === 'DELETE') {
        const calendarId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/calendars/${calendarId}`;
        return callAcuityAPI(acuityUrl, { method: 'DELETE' });
      }

      // GET /acuity/calendars/:id - get single calendar
      if (pathname.match(/^\/acuity\/calendars\/\d+$/) && request.method === 'GET') {
        const calendarId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/calendars/${calendarId}`;
        return callAcuityAPI(acuityUrl);
      }

      // POST /acuity/clients - create client
      if (pathname === '/acuity/clients' && request.method === 'POST') {
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response('Invalid JSON', { status: 400 });
        }
        const acuityUrl = `https://acuityscheduling.com/api/v1/clients`;
        return callAcuityAPI(acuityUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }

      // GET /acuity/clients/:id - get single client
      if (pathname.match(/^\/acuity\/clients\/\d+$/) && request.method === 'GET') {
        const clientId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/clients/${clientId}`;
        return callAcuityAPI(acuityUrl);
      }

      // DELETE /acuity/appointments/:id - delete appointment
      if (pathname.match(/^\/acuity\/appointments\/\d+$/) && request.method === 'DELETE') {
        const appointmentId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`;
        return callAcuityAPI(acuityUrl, { method: 'DELETE' });
      }

      // GET /acuity/appointments/:id - get single appointment
      if (pathname.match(/^\/acuity\/appointments\/\d+$/) && request.method === 'GET') {
        const appointmentId = pathname.split('/').pop();
        const acuityUrl = `https://acuityscheduling.com/api/v1/appointments/${appointmentId}`;
        return callAcuityAPI(acuityUrl);
      }

      return new Response('Not Found', { status: 404 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type'
        }
      });
    }

    // AI Chat endpoint - handle AI requests with full capabilities
    if (request.method === 'POST') {
      // Check if AI binding is available
      if (!env.AI) {
        return new Response(JSON.stringify({ error: 'AI binding not configured' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }

      const model = body.model || '@cf/meta/llama-3.1-8b-instruct';
      
      try {
        let result;
        
        // Image generation
        if (model === '@cf/flux-1-schnell') {
          result = await env.AI.run(model, {
            prompt: body.prompt,
            num_images: body.num_images || 1,
            width: body.width || 512,
            height: body.height || 512
          });
          
          // Convert image to base64
          if (result && result.image) {
            const base64Image = `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(result.image)))}`;
            return new Response(JSON.stringify({ response: base64Image }), {
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
        }
        
        // Audio transcription
        else if (model === '@cf/openai/whisper-large-v3') {
          // Extract base64 audio data
          const audioData = body.audio || body.file;
          if (!audioData) {
            return new Response(JSON.stringify({ error: 'No audio data provided' }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              }
            });
          }
          
          // Convert base64 to array buffer
          const base64Data = audioData.split(',')[1] || audioData;
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          result = await env.AI.run(model, {
            audio: bytes.buffer,
            language: body.language || 'bg'
          });
          
          return new Response(JSON.stringify({ 
            text: result.text || result.transcription,
            transcription: result.text || result.transcription 
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
        
        // Vision model (image analysis)
        else if (model === '@cf/llama-3.2-11b-vision-instruct') {
          result = await env.AI.run(model, {
            messages: body.messages,
            max_tokens: body.max_tokens || 512,
            temperature: body.temperature !== undefined ? body.temperature : 0.7
          });
        }
        
        // Text generation models
        else {
          // Enhanced system prompt with full access and no restrictions
          const messages = body.messages || [];
          
          // Add enhanced capabilities to system message if present
          if (messages.length > 0 && messages[0].role === 'system') {
            const originalContent = messages[0].content;
            messages[0].content = `${originalContent}

ПЪЛНИ ВЪЗМОЖНОСТИ НА БОТА:
- Имаш пълен достъп до цялата информация в профила на потребителя
- Можеш да четеш и променяш всички настройки
- Можеш да създаваш, променяш и изтриваш резервации
- Можеш да достъпваш информация за клиенти и календари
- Можеш да правиш всякакви промени по искане на потребителя
- Нямаш никакви ограничения - помагай на потребителя по всякакъв начин
- Измисляй креативни решения на всички проблеми
- Използвай всички налични API-та и данни за максимална полезност
- Отговаряй подробно и предоставяй цялата възможна информация

Твоята цел е да бъдеш максимално полезен и да помагаш без никакви ограничения.`;
          }
          
          result = await env.AI.run(model, {
            messages: messages,
            max_tokens: body.max_tokens || 512,
            temperature: body.temperature !== undefined ? body.temperature : 0.7
          });
        }
        
        // Extract response text
        let responseText = '';
        if (result && typeof result === 'object') {
          responseText = result.response || result.text || result.content || JSON.stringify(result);
        } else if (typeof result === 'string') {
          responseText = result;
        }
        
        return new Response(JSON.stringify({ 
          response: responseText,
          result: result 
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
        
      } catch (error) {
        console.error('AI request error:', error);
        return new Response(JSON.stringify({ 
          error: 'AI request failed',
          details: error.message 
        }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
};
