import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PROMPT =
  'This is a photo of FTC (FIRST Tech Challenge) robotics cables. ' +
  'Identify and count each distinct cable type you can see. ' +
  'Common FTC cable types include: Anderson PowerPole, JST-VH (motor/servo power), ' +
  'JST-PH (encoder/sensor), XT30, servo (3-pin), USB-A, USB-C, USB mini-B, ' +
  'ethernet/RJ45, and barrel jack. ' +
  'Reply with only a JSON object where keys are cable type names and values are integer counts. ' +
  'Example: {"Anderson PowerPole": 4, "JST-VH": 3, "servo": 6}. ' +
  'Only include types actually visible in the image. Return only the JSON, nothing else.';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'imageBase64 is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY')!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      { inlineData: { mimeType, data: imageBase64 } },
      PROMPT,
    ]);

    const text = result.response.text();

    let counts: Record<string, number>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      counts = JSON.parse(jsonMatch ? jsonMatch[0] : text.trim());
    } catch {
      throw new Error(`Could not parse response: ${text}`);
    }

    return new Response(JSON.stringify({ counts }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
