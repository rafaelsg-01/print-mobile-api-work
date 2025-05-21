
import { ExecutionContext } from "@cloudflare/workers-types"
import Html_helloWord from './helloWord.html'
import { Type_envData } from './types_universal'


export default {
	async fetch(Parameter_request: Request, Parameter_env: Type_envData, Parameter_context: ExecutionContext): Promise<Response> {
		const Const_newUrl = new URL(Parameter_request.url)
		const Const_pathName = Const_newUrl.pathname

		const Const_passwordAdmin = 'r89467290'

		// Site: /test
		if (Const_pathName.startsWith('/test')) {
            return new Response(`Test 3: ${Parameter_env.Env_workplace}`, {
                status: 200
            })
		}

		// Site: /site/printMobile
		if (Const_pathName.startsWith('/site/printMobile') || Const_pathName === '/') {
            return new Response(Html_helloWord, {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                }
            })
		}

		// Input: POST /api/generate-print-mobile?adminPassword=string { urlSite: string; }
		// Output: JSON { photoArray: string[] }
		else if (Const_pathName.startsWith('/api/generate-print-mobile') && Parameter_request.method === 'POST') {
			try {
				const Const_requestBody = await Parameter_request.json() as { urlSite: string; }

				const Const_adminPassword = Const_newUrl.searchParams.get('adminPassword')
				const Const_urlSite = Const_requestBody?.urlSite

				if (Const_adminPassword !== Const_passwordAdmin) {
					console.log('WARNING [adminPassword !== ***] No permission')
					return new Response('WARNING [adminPassword !== ***] No permission', {status: 401})
				}

				if (!Const_urlSite) {
					console.log('WARNING [!Const_urlSite] Missing urlSite')
					return new Response('WARNING [!Const_urlSite] Missing urlSite', {status: 400})
				}

				// Acessa Site e tira os prints
				/* const Const_formatWhatsappClient = Function_formatWhatsappClient(Const_whatsappClient)

				const Const_initialApiSendMessage = await Function_initialApiSendMessage(Const_userBot, Const_formatWhatsappClient, Const_message, Parameter_env, Const_speedBoolean)
				if (!Const_initialApiSendMessage) {
					console.log('ERRO [!initialApiSendMessage] Error in initialApiSendMessage')
					return new Response('ERRO [!initialApiSendMessage] Error in initialApiSendMessage', {status: 500})
				} */

				return new Response('SUCCESS [sent] Message sent successfully!', {
					status: 200
				})
			}

			catch (error) {
				console.log('ERRO [catch] Erro in /api/generate-print-mobile', error)
				return new Response('ERRO [catch] Erro in /api/generate-print-mobile', {status: 500})
			}
		}

		else {
			return new Response('No found', { status: 404 })
		}
	}
}
