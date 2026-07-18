import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS', // Добавлено
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const { sessionId, breweryId, locale = 'ru' } = await req.json()
    if (!sessionId || !breweryId) throw new Error('Missing sessionId or breweryId')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 1. Получаем данные сессии
    const { data: session, error: sessionError } = await supabaseClient
      .from('brew_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('brewery_id', breweryId)
      .single()

    if (sessionError || !session) throw new Error('Session not found or access denied')

    // 2. Получаем логи брожения
    const { data: logs, error: logsError } = await supabaseClient
      .from('daily_fermentation_logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('logged_at', { ascending: true })

    if (logsError) throw new Error('Failed to fetch logs')

    // 3. Формируем промпт для Gemini
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY is not set')

    const prompt = `
      You are an expert master brewer and mazer (mead maker). Analyze the following completed brew session and its fermentation logs.
      
      Beverage Type: ${session.beverage_type}
      Recipe Name: ${session.recipe_name}
      Target OG: ${session.target_og} | Actual OG: ${session.actual_original_gravity}
      Target FG: ${session.target_fg} | Actual FG: ${session.actual_final_gravity}
      Batch Size: ${session.actual_batch_size_liters}L
      
      TOSNA Schedule & Nutrients:
      ${JSON.stringify(session.tosna_schedule)}
      
      Fermentation Logs (Chronological):
      ${JSON.stringify(logs.map(l => ({ time: l.logged_at, sg: l.gravity_reading, ph: l.ph_reading, temp: l.liquid_temperature_c, notes: l.notes })))}
      
      Task:
      Analyze the fermentation curve, the timing of nutrient additions (if any), and the final attenuation. 
      Did it stall? Did it finish too fast or too slow? Were there temperature spikes?
      
      Provide your response in the requested language: ${locale}.
      Return ONLY a valid JSON object with the following structure, without markdown code blocks:
      {
        "score": <number 0-100 based on fermentation health and target matching>,
        "report": "<string formatted in Markdown with your detailed analysis, observations, and recommendations for the next batch>"
      }
    `

    // 4. Отправляем запрос в Gemini REST API
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.4
        }
      })
    })

    const geminiData = await response.json()
    if (!response.ok) throw new Error(`Gemini API Error: ${JSON.stringify(geminiData)}`)

    const aiResponseText = geminiData.candidates[0].content.parts[0].text
    const analysisResult = JSON.parse(aiResponseText)

    // 5. Сохраняем результат обратно в базу данных
    const { error: updateError } = await supabaseClient
      .from('brew_sessions')
      .update({
        ai_analysis_report: analysisResult.report,
        ai_score: analysisResult.score
      })
      .eq('id', sessionId)
      .eq('brewery_id', breweryId)

    if (updateError) throw new Error('Failed to save AI report to database')

    return new Response(JSON.stringify({ success: true, score: analysisResult.score, report: analysisResult.report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})