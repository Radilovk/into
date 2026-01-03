// Cloudflare Worker - Client Portal Backend
// Deployed at: https://workerai.radilov-k.workers.dev/

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'https://radilovk.github.io',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Rate limiting helper
    const checkRateLimit = async (identifier) => {
      if (!env.APP_KV) return { allowed: true };
      
      const key = `ratelimit:${identifier}`;
      const count = await env.APP_KV.get(key);
      
      if (count && parseInt(count) > 10) {
        return { allowed: false, retryAfter: 60 };
      }
      
      const newCount = count ? parseInt(count) + 1 : 1;
      await env.APP_KV.put(key, newCount.toString(), { expirationTtl: 60 });
      
      return { allowed: true };
    };

    // Helper: Acuity API request
    const acuityRequest = async (path, method = 'GET', body = null) => {
      // Support both new and legacy secret names for backward compatibility
      const userId = env.ACUITY_USER_ID || env.ACUITY_USER;
      const apiKey = env.ACUITY_API_KEY || env.ACUITY_KEY;
      
      if (!userId || !apiKey) {
        throw new Error('Acuity credentials not configured');
      }

      const auth = btoa(`${userId}:${apiKey}`);
      const options = {
        method,
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      };

      if (body && method !== 'GET') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`https://acuityscheduling.com/api/v1${path}`, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Acuity API error: ${response.status} - ${errorText}`);
        throw new Error(`Acuity API error: ${response.status}`);
      }

      return await response.json();
    };

    // Helper: Get client by email
    const getClientByEmail = async (email) => {
      try {
        const clients = await acuityRequest('/clients');
        return clients.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
      } catch (error) {
        console.error('Error fetching client:', error);
        return null;
      }
    };

    // Helper: Get appointments by email
    const getAppointmentsByEmail = async (email, options = {}) => {
      try {
        const { minDate, maxDate } = options;
        let path = '/appointments';
        const params = new URLSearchParams();
        
        if (minDate) params.append('minDate', minDate);
        if (maxDate) params.append('maxDate', maxDate);
        
        if (params.toString()) {
          path += `?${params.toString()}`;
        }

        const appointments = await acuityRequest(path);
        return appointments.filter(apt => 
          apt.email && apt.email.toLowerCase() === email.toLowerCase()
        );
      } catch (error) {
        console.error('Error fetching appointments:', error);
        return [];
      }
    };

    // Helper: Create appointment
    const createAppointment = async (appointmentData) => {
      return await acuityRequest('/appointments', 'POST', appointmentData);
    };

    // Helper: Cancel appointment
    const cancelAppointment = async (appointmentID) => {
      return await acuityRequest(`/appointments/${appointmentID}/cancel`, 'PUT', {});
    };

    // Helper: Get balance from KV
    const getBalance = async (email) => {
      if (!env.APP_KV) return null;
      const balanceStr = await env.APP_KV.get(`client:${email}:balance`);
      return balanceStr ? parseInt(balanceStr) : null;
    };

    // Helper: Set balance in KV
    const setBalance = async (email, balance) => {
      if (!env.APP_KV) return;
      await env.APP_KV.put(`client:${email}:balance`, balance.toString());
    };

    // Helper: Check if trial used
    const isTrialUsed = async (email) => {
      if (!env.APP_KV) return false;
      const trialStr = await env.APP_KV.get(`client:${email}:trial_used`);
      return trialStr === 'true';
    };

    // Helper: Mark trial as used
    const markTrialUsed = async (email) => {
      if (!env.APP_KV) return;
      await env.APP_KV.put(`client:${email}:trial_used`, 'true');
    };

    // Helper: Check if can book
    const checkCanBook = async (email, upcomingCount) => {
      const balance = await getBalance(email);
      const trialUsed = await isTrialUsed(email);

      // Client with active card/package
      if (balance !== null && balance > 0) {
        if (upcomingCount >= balance) {
          return { 
            canBook: false, 
            reason: `Имате ${upcomingCount} бъдещи резервации. Вашата карта позволява максимум ${balance} посещения.`
          };
        }
        return { canBook: true, reason: '' };
      }

      // Client without package - only 1 trial allowed
      if (trialUsed) {
        return { 
          canBook: false, 
          reason: 'Вече сте използвали вашата пробна резервация. Моля, закупете пакет за нови резервации.'
        };
      }

      if (upcomingCount >= 1) {
        return { 
          canBook: false, 
          reason: 'Имате вече 1 бъдеща резервация. Без активен пакет можете да имате само 1 резервация.'
        };
      }

      return { canBook: true, reason: 'Пробна резервация (без пакет)' };
    };

    try {
      // GET /api/health
      if (pathname === '/api/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({ success: true, message: 'Service is running' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // GET /api/me?email=...
      if (pathname === '/api/me' && request.method === 'GET') {
        const email = url.searchParams.get('email');
        
        if (!email) {
          return new Response(
            JSON.stringify({ success: false, message: 'Email parameter required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limiting
        const rateLimit = await checkRateLimit(email);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Retry-After': rateLimit.retryAfter.toString()
              } 
            }
          );
        }

        // Get client info
        const client = await getClientByEmail(email);
        
        // Get appointments
        const now = new Date();
        const allAppointments = await getAppointmentsByEmail(email);
        
        const upcomingAppointments = allAppointments
          .filter(apt => new Date(apt.datetime) >= now && apt.canceled === false)
          .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
        
        const pastAppointments = allAppointments
          .filter(apt => new Date(apt.datetime) < now || apt.canceled === true)
          .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())
          .slice(0, 10); // Last 10

        // Get balance
        const balance = await getBalance(email);
        
        // Check if can book
        const bookingCheck = await checkCanBook(email, upcomingAppointments.length);

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              client: client || { email },
              balance: balance,
              upcomingAppointments: upcomingAppointments.map(apt => ({
                id: apt.id,
                datetime: apt.datetime,
                type: apt.type,
                duration: apt.duration,
                appointmentTypeID: apt.appointmentTypeID,
              })),
              pastAppointments: pastAppointments.map(apt => ({
                id: apt.id,
                datetime: apt.datetime,
                type: apt.type,
                canceled: apt.canceled,
              })),
              canBook: bookingCheck.canBook,
              reason: bookingCheck.reason,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // POST /api/book
      if (pathname === '/api/book' && request.method === 'POST') {
        const body = await request.json();
        const { email, appointmentTypeID, datetime, timezone, firstName, lastName, phone } = body;

        if (!email || !appointmentTypeID || !datetime) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Missing required fields: email, appointmentTypeID, datetime' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limiting
        const rateLimit = await checkRateLimit(email);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Retry-After': rateLimit.retryAfter.toString()
              } 
            }
          );
        }

        // Check current appointments
        const now = new Date();
        const allAppointments = await getAppointmentsByEmail(email);
        const upcomingCount = allAppointments.filter(
          apt => new Date(apt.datetime) >= now && apt.canceled === false
        ).length;

        // Validate booking rules
        const bookingCheck = await checkCanBook(email, upcomingCount);
        if (!bookingCheck.canBook) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: bookingCheck.reason 
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create appointment
        const appointmentData = {
          appointmentTypeID: parseInt(appointmentTypeID),
          datetime,
          email,
          timezone: timezone || 'Europe/Sofia',
        };

        if (firstName) appointmentData.firstName = firstName;
        if (lastName) appointmentData.lastName = lastName;
        if (phone) appointmentData.phone = phone;

        try {
          const appointment = await createAppointment(appointmentData);

          // Update balance if client has a package
          const balance = await getBalance(email);
          if (balance !== null && balance > 0) {
            await setBalance(email, balance - 1);
          } else {
            // Mark trial as used for first-time users
            await markTrialUsed(email);
          }

          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Резервацията е създадена успешно!',
              data: { appointment }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error creating appointment:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Грешка при създаване на резервация. Моля, опитайте отново.'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // POST /api/cancel
      if (pathname === '/api/cancel' && request.method === 'POST') {
        const body = await request.json();
        const { email, appointmentID } = body;

        if (!email || !appointmentID) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Missing required fields: email, appointmentID' 
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Rate limiting
        const rateLimit = await checkRateLimit(email);
        if (!rateLimit.allowed) {
          return new Response(
            JSON.stringify({ success: false, message: 'Too many requests. Please try again later.' }),
            { 
              status: 429, 
              headers: { 
                ...corsHeaders, 
                'Content-Type': 'application/json',
                'Retry-After': rateLimit.retryAfter.toString()
              } 
            }
          );
        }

        try {
          // Get appointment details
          const appointment = await acuityRequest(`/appointments/${appointmentID}`);
          
          // Verify email matches
          if (appointment.email.toLowerCase() !== email.toLowerCase()) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Нямате право да отмените тази резервация.'
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Check if appointment is in the future
          const appointmentTime = new Date(appointment.datetime);
          const now = new Date();
          
          if (appointmentTime <= now) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                message: 'Не можете да отмените минала резервация.'
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Check if cancellation is >= 12 hours before appointment
          const hoursUntilAppointment = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
          const shouldRefund = hoursUntilAppointment >= 12;

          // Cancel appointment
          await cancelAppointment(appointmentID);

          // Refund visit if applicable and client has a package
          const balance = await getBalance(email);
          if (shouldRefund && balance !== null) {
            await setBalance(email, balance + 1);
          }

          const message = shouldRefund 
            ? 'Резервацията е отменена успешно! Посещението е възстановено.'
            : 'Резервацията е отменена успешно! Отмяната е по-малко от 12 часа преди часа - посещението не се връща.';

          return new Response(
            JSON.stringify({ 
              success: true, 
              message,
              data: { refunded: shouldRefund }
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (error) {
          console.error('Error canceling appointment:', error);
          return new Response(
            JSON.stringify({ 
              success: false, 
              message: 'Грешка при отмяна на резервация. Моля, опитайте отново.'
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Route not found
      return new Response(
        JSON.stringify({ success: false, message: 'Endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Internal server error',
          error: error.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};
