/* 1. run `npm create cloudflare@latest` to create this application.
 * 2. run `npx wrangler d1 create temperature` to create database.
 * 3. run `npx wrangler d1 execute temperature --file=temperature.sql --remote`
 *    to update the remote database.
 * 4. run `npm run deploy` to upload this application.
 * 5. run `npx wrangler secret put BIRD_API_KEY` to upload a secret.
 */
export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        let urlpath = url.pathname;

        if (urlpath.startsWith('/birdroom')) {
            urlpath = urlpath.substring('/birdroom'.length); // remove '/rooms' prefix
            if (urlpath === '') {
                urlpath = '/';
            }
        }

        if (urlpath.startsWith('/op')) {
            const apiKey = request.headers.get('x-api-key');

            if (!apiKey || apiKey !== env.BIRD_API_KEY) {
                return new Response('Unauthorized', { status: 401 });
            }
            if (request.method != 'POST') {
                return new Response('Method Not Allowed', { status: 405 });
            }
        }

        switch (urlpath) {
            case '/op/add':
                return addTemperatureRecord(request, env);
            case '/temp':
                return getTemperatureData(request, env);
            case '/rooms':
                return getRoomList(request, env);
            default:
                return new Response('Not Found', { status: 404 });
        }
    },
};

async function addTemperatureRecord(request, env) {
    try {
        const data = await request.json();
        const { room_id, temperature, humidity } = data;
        if (!room_id || temperature === undefined) {
            return new Response('Bad Request: Missing room_id or temperature', { status: 400 });
        }
        const humidityValue = humidity !== undefined ? parseFloat(humidity) : null;

        const stmt = await env.DB.prepare(
            'INSERT INTO temperature (room_id, temperature, humidity) VALUES (?, ?, ?)'
        );
        await stmt.bind(room_id, parseFloat(temperature), humidityValue).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: 'Invalid JSON or Database Error' }), { status: 400 });
    }
}

async function getTemperatureData(request, env) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    const roomId = searchParams.get('room_id');
    const startTime = searchParams.get('start_time'); // Expecting ISO UTC string
    const endTime = searchParams.get('end_time');     // Expecting ISO UTC string

    let whereConditions = [];
    let queryParams = [];

    if (roomId) {
      whereConditions.push('room_id = ?');
      queryParams.push(roomId);
    }

    // Filter by Time Range
    if (startTime && endTime) {
      whereConditions.push("recorded_at >= ? AND recorded_at < ?");
      // The frontend sends full ISO strings (e.g., "2023-11-29T16:00:00.000Z")
      // SQLite stores simplified strings, but ISO comparison works fine alphabetically
      const formattedStart = startTime.replace('T', ' ').replace('Z', '');
      const formattedEnd = endTime.replace('T', ' ').replace('Z', '');

      queryParams.push(formattedStart, formattedEnd);
      // queryParams.push(startTime, endTime);
    } else {
      // Fallback: Default to last 24 hours if no specific range provided
      whereConditions.push("recorded_at > datetime('now', '-1 day')");
    }

    let query = `
      SELECT room_id, temperature, humidity, recorded_at
      FROM temperature
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY recorded_at ASC
    `;

    let stmt = env.DB.prepare(query);

    // Bind all parameters using spread syntax
    stmt = stmt.bind(...queryParams);

    const { results } = await stmt.all();

    return new Response(JSON.stringify({
      success: true,
      data: results
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Database error',
      details: error.message
    }), { status: 500 });
  }
}

async function getRoomList(request, env) {
    try {
        const { results } = await env.DB.prepare('SELECT id, name FROM rooms').all();
        return Response.json(results);
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
