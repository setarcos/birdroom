import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect, beforeAll } from 'vitest';
import worker from '../src/index';

// Define a test API key to use in our mock environment
const TEST_API_KEY = 'test-secret-key';

describe('Birdcage Temperature Worker', () => {

    // Setup: Ensure the database table exists before running tests
    // In the test environment (Miniflare), the DB starts empty.
    beforeAll(async () => {
        await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS temperature (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id INTEGER NOT NULL CHECK (room_id BETWEEN 1 AND 26),
                temperature REAL NOT NULL,
                recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `).run();
    });

    describe('POST /op/add (Adding Records)', () => {

        it('responds with 401 Unauthorized if API key is missing', async () => {
            const request = new Request('http://example.com/op/add', {
                method: 'POST',
                body: JSON.stringify({ room_id: 1, temperature: 25.5 })
            });

            // Pass the environment, but intentionally omit or assume mismatched API Key
            const testEnv = { ...env, ARCH_API_KEY: 'wrong-key' };

            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);

            expect(response.status).toBe(401);
            expect(await response.text()).toBe('Unauthorized');
        });

        it('responds with 200 Success when valid', async () => {
            const request = new Request('http://example.com/op/add', {
                method: 'POST',
                headers: { 'x-api-key': TEST_API_KEY },
                body: JSON.stringify({ room_id: 1, temperature: 25.5 })
            });

            // Inject the correct API Key into the environment object
            const testEnv = { ...env, ARCH_API_KEY: TEST_API_KEY };

            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);

            expect(response.status).toBe(200);
            const body = await response.json();
            expect(body).toEqual({ success: true });
        });

        it('responds with 400 if room_id is missing', async () => {
            const request = new Request('http://example.com/op/add', {
                method: 'POST',
                headers: { 'x-api-key': TEST_API_KEY },
                // Missing room_id
                body: JSON.stringify({ temperature: 25.5 })
            });

            const testEnv = { ...env, ARCH_API_KEY: TEST_API_KEY };
            const ctx = createExecutionContext();
            const response = await worker.fetch(request, testEnv, ctx);
            await waitOnExecutionContext(ctx);

            expect(response.status).toBe(400);
        });
    });

    describe('GET /temp (Querying Data)', () => {

        // Helper to manually insert data into D1 for testing
        async function seedData() {
            // Insert a record for "2025-11-30 12:00:00" UTC
            await env.DB.prepare(
                "INSERT INTO temperature (room_id, temperature, recorded_at) VALUES (?, ?, ?)"
            ).bind(1, 24.5, '2025-11-30 12:00:00').run();

            // Insert a record for an older date (should be filtered out)
            await env.DB.prepare(
                "INSERT INTO temperature (room_id, temperature, recorded_at) VALUES (?, ?, ?)"
            ).bind(1, 20.0, '2025-11-01 12:00:00').run();
        }

        it('retrieves data using start_time and end_time', async () => {
            await seedData();

            // Query specifically for the date we inserted (covering the UTC range)
            const startTime = '2025-11-30T00:00:00Z';
            const endTime = '2025-11-30T23:59:59Z';

            const url = `http://example.com/temp?room_id=1&start_time=${startTime}&end_time=${endTime}`;
            const request = new Request(url);

            const ctx = createExecutionContext();
            const response = await worker.fetch(request, env, ctx);
            await waitOnExecutionContext(ctx);

            expect(response.status).toBe(200);

            const json = await response.json();
            expect(json.success).toBe(true);

            // Should find the one record from the 30th
            expect(json.data.length).toBe(1);
            expect(json.data[0].temperature).toBe(24.5);
            expect(json.data[0].recorded_at).toBe('2025-11-30 12:00:00');
        });

        it('returns empty list if no data in range', async () => {
            // Query for a future date
            const url = `http://example.com/temp?room_id=1&start_time=2099-01-01T00:00:00Z&end_time=2099-01-02T00:00:00Z`;
            const request = new Request(url);

            const ctx = createExecutionContext();
            const response = await worker.fetch(request, env, ctx);
            await waitOnExecutionContext(ctx);

            const json = await response.json();
            expect(json.data.length).toBe(0);
        });
    });
});
