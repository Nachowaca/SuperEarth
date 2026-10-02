import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        {
          name: 'api-maps-grounding',
          configureServer(server) {
            server.middlewares.use('/api/maps-grounding', async (req, res) => {
              if (req.method !== 'POST') {
                res.statusCode = 405;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
              }

              let body = '';
              req.on('data', (chunk) => {
                body += chunk;
              });

              req.on('end', async () => {
                try {
                  const data = JSON.parse(body || '{}');
                  const query = data.query || data.city || 'Tierra';
                  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

                  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      text: `📍 **Exploración de ${query}**\n\nDescubre los puntos más emblemáticos, rascacielos y monumentos de ${query}. ¡Vuela libremente o usa los controles aéreos para explorar cada rincón!`,
                      source: 'fallback',
                    }));
                    return;
                  }

                  const { GoogleGenAI } = await import('@google/genai');
                  const ai = new GoogleGenAI({ apiKey });

                  const prompt = `You are a superhero flight guide and Google Earth explorer.
Using Google Maps data, provide up-to-date grounded tourist information for exploring: "${query}".
Include:
1. A brief 2-sentence captivating description of the city/location.
2. 3 iconic landmarks with real coordinates in this format: [LAT, LNG] Landmark Name - Brief note
3. The most exciting aerial view or flight challenge here.`;

                  const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: {
                      tools: [{ googleMaps: {} }],
                    },
                  });

                  const text = response.text || '';
                  const candidates = response.candidates || [];
                  const groundingMetadata = (candidates[0] as any)?.groundingMetadata || null;

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    text,
                    groundingMetadata,
                    source: 'googleMaps',
                  }));
                } catch (err: any) {
                  console.error('Error in /api/maps-grounding:', err);
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    text: `Información sobre el destino disponible en el visor 3D de Google Earth.`,
                    error: err.message,
                    source: 'fallback',
                  }));
                }
              });
            });
          },
        },
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyAbPTU5J7TkNHpvHRmQUEWTF9EVUzv8FIk')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
