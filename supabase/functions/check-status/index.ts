import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { task_id, api_key } = await req.json()

    if (!task_id || !api_key) {
      return new Response(
        JSON.stringify({ error: 'Missing task_id or api_key', success: false }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check status with Tripo API
    const response = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${task_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${api_key}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Tripo status check error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to check generation status', success: false }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const result = await response.json()
    const taskData = result.data
    
    console.log('Tripo API response:', JSON.stringify(result, null, 2))
    console.log('Task data:', JSON.stringify(taskData, null, 2))
    console.log('Task status:', taskData.status)
    console.log('Task output:', JSON.stringify(taskData.output, null, 2))
    
    return new Response(
      JSON.stringify({ 
        status: taskData.status,
        progress: taskData.progress,
        model_url: taskData.output?.model || taskData.output?.result?.model || taskData.result?.model || taskData.model_url || taskData.download_url || null,
        error: taskData.error || null,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Check status function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', success: false }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})