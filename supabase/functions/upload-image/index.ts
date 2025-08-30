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
    const formData = await req.formData()
    const image = formData.get('image') as File
    const apiKey = formData.get('api_key') as string

    if (!image) {
      return new Response(
        JSON.stringify({ error: 'No file provided', success: false }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'No API key provided', success: false }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Upload image to Tripo API
    const uploadFormData = new FormData()
    uploadFormData.append('file', image)

    const uploadResponse = await fetch('https://api.tripo3d.ai/v2/openapi/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: uploadFormData,
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('Tripo upload error:', errorText)
      return new Response(
        JSON.stringify({ error: 'Failed to upload to Tripo API', success: false }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const uploadResult = await uploadResponse.json()
    
    return new Response(
      JSON.stringify({ 
        token: uploadResult.data.image_token,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Upload function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', success: false }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})