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
    const url = new URL(req.url)
    const modelUrl = url.searchParams.get('url')
    
    if (!modelUrl) {
      return new Response('Missing url parameter', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    console.log('Proxying model from:', modelUrl)

    // Fetch the model file from the external URL
    const response = await fetch(modelUrl)
    
    if (!response.ok) {
      console.error('Failed to fetch model:', response.status, response.statusText)
      return new Response(`Failed to fetch model: ${response.statusText}`, { 
        status: response.status, 
        headers: corsHeaders 
      })
    }

    const modelData = await response.arrayBuffer()
    
    // Return the model data with proper CORS headers
    return new Response(modelData, {
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'model/gltf-binary',
        'Content-Length': modelData.byteLength.toString(),
      }
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(`Proxy error: ${error.message}`, { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})