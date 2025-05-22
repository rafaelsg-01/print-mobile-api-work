
import { ExecutionContext } from "@cloudflare/workers-types"
import Html_homePrintMobile from './homePrintMobile.html'
import { Type_envData } from './types_universal'
import puppeteer from "@cloudflare/puppeteer"
//import { launch, limits } from "@cloudflare/playwright"

// @ts-ignore
import _Jimp from 'jimp'; const Jimp: typeof _Jimp = (typeof self !== 'undefined') ? (self.Jimp || _Jimp) : _Jimp


export default {
	async fetch(Parameter_request: Request, Parameter_env: Type_envData, Parameter_context: ExecutionContext): Promise<Response> {
		const Const_newUrl = new URL(Parameter_request.url)
		const Const_pathName = Const_newUrl.pathname

		const Const_passwordAdmin = 'r89467290'

		// Site: /site/printMobile
		if (Const_pathName.startsWith('/site/printMobile') || Const_pathName === '/') {
            return new Response(Html_homePrintMobile, {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                }
            })
		}

		// Input: POST /api/private/generate-print-mobile?adminPassword=string { urlSite: string; userCode?: string; quality?: number; }[]
		// Output: JSON { photoArray: string[] }
		else if (Const_pathName.startsWith('/api/private/generate-print-mobile') && Parameter_request.method === 'POST') {
			try {
				const Const_requestBody = await Parameter_request.json() as { urlSite: string; userCode?: string; quality?: number; }[]

				const Const_adminPassword = Const_newUrl.searchParams.get('adminPassword')

				if (Const_adminPassword !== Const_passwordAdmin) {
					console.log('WARNING [adminPassword !== ***] No permission')
					return new Response('WARNING [adminPassword !== ***] No permission', {status: 401})
				}

				if (!Array.isArray(Const_requestBody) || Const_requestBody.length === 0) {
					console.log('WARNING [!Const_requestBody.length] Missing array of urlSite')
					return new Response('WARNING [!Const_requestBody.length] Missing array of urlSite', {status: 400})
				}

				const Const_browser = await puppeteer.launch(Parameter_env.Browser_printMobile)
				const Const_limits = await puppeteer.limits(Parameter_env.Browser_printMobile)
				const Const_allowedBrowserAcquisitions = Const_limits.allowedBrowserAcquisitions

				if (Const_allowedBrowserAcquisitions === 0) {
					console.log('WARNING [Const_allowedBrowserAcquisitions === 0] No browser available')
					return new Response('WARNING [Const_allowedBrowserAcquisitions === 0] No browser available', {status: 504})
				}

				const Const_maxConcurrent = Const_allowedBrowserAcquisitions
				const Const_tasks: (() => Promise<string>)[] = Const_requestBody.map((Const_item) => {
					return async () => {
						const Const_page = await Const_browser.newPage()

						await Const_page.goto(Const_item.urlSite)
						await Const_page.setViewport({
							width: 430,
							height: 932,
							deviceScaleFactor: Const_item.quality || 3,
							isMobile: true,
							hasTouch: true,
							isLandscape: false
						})

						if (Const_item.userCode?.split('//#CUT#')[0]) {
							await Const_page.evaluate(async (Parameter_code) => {
								await eval(Parameter_code)
							}, Const_item.userCode?.split('//#CUT#')[0])
						}

						if (Const_item.userCode?.split('//#CUT#')[1]) {
                            await Const_page.reload()

							await Const_page.evaluate(async (Parameter_code) => {
								await eval(Parameter_code)
							}, Const_item.userCode?.split('//#CUT#')[1])
						}

						const Const_printArrayBuffer = await Const_page.screenshot({ type: 'png' })
						await Const_page.close()

						// Add template mobile
        				const Const_printJimp = await Jimp.read(Const_printArrayBuffer)

						const Const_templateR2 = await Parameter_env.R2_printMobile.get('template/full-template2-apple-iphone-16-pro-max-2024.png')
						const Const_templateArrayBuffer = await Const_templateR2?.arrayBuffer()
        				const Const_templateJimp = await Jimp.read(Const_templateArrayBuffer)

						const Const_modelPhotoWidth = Const_templateJimp.getWidth()
						const Const_modelPhotoHeight = Const_templateJimp.getHeight()
						const Const_backgroundPhotoJimp = await Jimp.read(Const_modelPhotoWidth, Const_modelPhotoHeight, 0)

						const Const_printWidthNew = 1323
						const Const_printHeightNew = 2694
						Const_printJimp.resize(Const_printWidthNew, Const_printHeightNew)

						Const_backgroundPhotoJimp.blit(Const_printJimp, 261, 341)
						Const_backgroundPhotoJimp.blit(Const_templateJimp, 0, 0)

						const Const_backgroundPhotoArrayBuffer = await Const_backgroundPhotoJimp.getBufferAsync(Jimp.MIME_PNG)

						const Const_lastNameUrlSite = Const_item.urlSite.replace(/\/$/, '').split('/').pop() || 'default'
						const Const_nameFileR2 = `${Const_lastNameUrlSite}/${crypto.randomUUID()}.png`

						//a = Const_backgroundPhotoArrayBuffer
						const Const_r2Option = {
							httpMetadata: {
								contentType: 'image/png',
							}
						}

						const Const_r2ResultPut = await Parameter_env.R2_printMobile.put(Const_nameFileR2, Const_backgroundPhotoArrayBuffer, Const_r2Option)
						if (!Const_r2ResultPut) {
							console.log('WARNING [!Const_r2ResultPut] Error uploading to R2')
							throw new Error('WARNING [!Const_r2ResultPut] Error uploading to R2')
						}

						return `${Parameter_env.Env_linkBackend}/api/public/get-midia?path=${Const_nameFileR2}`
					}
				})

				const Const_executeBatches = async (tasks: (() => Promise<string>)[], limit: number): Promise<string[]> => {
					const Const_results: string[] = []
					let Const_index = 0

					async function Const_next(): Promise<void> {
						if (Const_index >= tasks.length) return
						const Const_currentIndex = Const_index++
						try {
							const Const_result = await tasks[Const_currentIndex]()
							Const_results[Const_currentIndex] = Const_result
						} catch (error) {
							console.log('WARNING [task error]', error)
							Const_results[Const_currentIndex] = ''
						}
						await Const_next()
					}

					const Const_promises = Array.from({ length: limit }, () => Const_next())
					await Promise.all(Const_promises)
					return Const_results.filter(Boolean)
				}

				const Const_r2Urls = await Const_executeBatches(Const_tasks, Const_maxConcurrent)

				await Const_browser.close()

				return new Response(JSON.stringify({ photoArray: Const_r2Urls }), {
					status: 200,
					headers: {
						'Content-Type': 'application/json',
						'Cache-Control': 'no-cache',
						'Access-Control-Allow-Origin': '*',
					}
				})

				// return buffer PNG
				/* return new Response(a, {
					status: 200,
					headers: {
						'Content-Type': 'image/png',
						'Content-Disposition': `attachment; filename="print-mobile.png"`,
						'Cache-Control': 'no-cache',
						'Access-Control-Allow-Origin': '*',
					}
				}) */
			} catch (error) {
				console.log('ERRO [catch] Erro in /api/private/generate-print-mobile', error)
				return new Response('ERRO [catch] Erro in /api/private/generate-print-mobile', {status: 500})
			}
		}

		// Input: GET /api/public/get-midia?path=string
		// Output: BUFFER
		else if (Const_pathName.startsWith('/api/public/get-midia') && Parameter_request.method === 'GET') {
			try {
				const Const_path = Const_newUrl.searchParams.get('path')

				if (!Const_path) {
					console.log('WARNING [!Const_path] Missing path 2')
					return new Response('WARNING [!Const_path] Missing path 2', {status: 400})
				}

				const Const_r2ResultGet = await Parameter_env.R2_printMobile.get(Const_path.replace(/^\/?/, ''))

				if (!Const_r2ResultGet) {
					console.log('WARNING [!Const_file] File not found')
					return new Response('WARNING [!Const_file] File not found', {status: 404})
				}

				const Const_blob = await Const_r2ResultGet.blob()

            	const Const_response = new Response(Const_blob, {
					status: 200,
					headers: {
						'Content-Disposition': `attachment; filename="${Const_path}"`,
						'Cache-Control': 'no-cache',
						'Access-Control-Allow-Origin': '*',
					}
				})

				const Const_r2ContentType = Const_r2ResultGet?.httpMetadata?.contentType
				if (Const_r2ContentType) {
					Const_response.headers.set('Content-Type', Const_r2ContentType)
				}

				return Const_response
			}

			catch (error) {
				console.log('ERRO [catch] Erro in /api/public/get-midia', error)
				return new Response('ERRO [catch] Erro in /api/public/get-midia', {status: 500})
			}
		}

        else if (Const_pathName.startsWith('/send') && Parameter_env.Env_workplace === 'dev_local') {
            // retorna uma pagina html
            const html = `
                <!DOCTYPE html>
                <html lang="pt-BR">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Upload de Arquivo R2</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
                <style>
                    body {
                        font-family: Arial, sans-serif;
                    }
                    #upload-container {
                        margin: 50px auto;
                        padding: 20px 10px 40px 10px;
                        border: 2px solid #ccc;
                        border-radius: 5px;
                        text-align: center;
                    }
                    #file-drop-area {
                        width: 200px;
                        height: 200px;
                        border: 2px dashed #aaa;
                        border-radius: 10px;
                        margin: 20px auto;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                    }
                    #file-drop-area.received {
                        border: 2px solid #666;
                    }
                    #file-drop-area i {
                        font-size: 40px;
                        color: #aaa;
                        cursor: pointer;
                        transition: color 0.3s;
                    }
                    #file-drop-area i:hover {
                        color: #333;
                    }
                    #file-name {
                        margin: 10px 0;
                    }
                    #upload-button,
                    #remove-button {
                        margin-top: 10px;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: background-color 0.3s;
                    }
                    #upload-button {
                        background-color: #4CAF50;
                        color: white;
                    }
                    #remove-button {
                        background-color: #f44336;
                        color: white;
                    }
                    #remove-button:hover {
                        background-color: #df5349;
                    }
                    #upload-button:hover {
                        background-color: #45a049;
                    }
                    #plus {
                        padding: 90px;
                    }
                    #file-name {
                        font-weight: bold;
                        border-radius: 5px;
                        margin: 20px 0;
                        border: 1px solid #ccc;
                        width: 100%;
                        padding: 8px 8px 8px 8px;
                        box-sizing: border-box;
                        font-size: 16px;
                    }
                    #file-name:focus {
                        outline: none;
                        border-color: #66ccff;
                    }
                    button:disabled {
                        background-color: #a5a5a5 !important;
                        cursor: default !important;
                    }
                </style>
                </head>
                <body>

                <div id="upload-container">
                    <h1 style="margin-bottom: 40px">Upload File R2</h1>
                    <div id="file-drop-area">
                        <i id="plus" class="fas fa-plus"></i>
                    </div>
                    <input type="file" id="file-input" accept=".txt,.pdf,.doc,.docx,.jpg,.png,.fnt" style="display:block;"> 
                    <input type="text" id="file-name" placeholder="Nome do Arquivo">
                    <div style="display: flex; justify-content: center; gap: 30px;">
                        <button id="upload-button" disabled>Enviar</button>
                        <button id="remove-button">Reiniciar</button>
                    </div>
                </div>

                <script>
                document.addEventListener("DOMContentLoaded", function() {
                    const fileDropArea = document.getElementById("file-drop-area");
                    const fileNameInput = document.getElementById("file-name");
                    const uploadButton = document.getElementById("upload-button");
                    const removeButton = document.getElementById("remove-button");
                    const fileInput = document.getElementById("file-input");
                    const currentDomain = window.location.origin;

                    fileDropArea.addEventListener("dragover", function(e) {
                        e.preventDefault();
                        fileDropArea.style.borderColor = "#66ccff";
                    });

                    fileDropArea.addEventListener("dragleave", function() {
                        fileDropArea.style.borderColor = "#aaa";
                    });

                    fileDropArea.addEventListener("drop", function(e) {
                        e.preventDefault();
                        fileDropArea.style.borderColor = "#aaa";
                        fileDropArea.classList.add("received");
                        const file = e.dataTransfer.files[0];
                    
                        // Cria um objeto DataTransfer para armazenar o arquivo
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(file);
                    
                        // Define o objeto DataTransfer como o valor do elemento de entrada de arquivo
                        fileInput.files = dataTransfer.files;
                    
                        handleFile(file);
                    });

                    fileInput.addEventListener("change", function() {
                        const file = fileInput.files[0];
                        fileDropArea.classList.add("received");
                        handleFile(file);
                    });

                    // Manipulador de evento drop para lidar com o arquivo arrastado
                    fileInput.addEventListener("drop", function(e) {
                        e.preventDefault();
                        const file = e.dataTransfer.items[0].getAsFile(); // Obter o arquivo do evento de queda
                        fileInput.files = e.dataTransfer.files; // Atualiza o valor do file input
                        fileDropArea.classList.add("received");
                        handleFile(file);
                    });

                    fileDropArea.addEventListener("click", function() {
                        fileInput.click();
                    });

                    function handleFile(file) {
                        if (file) {
                            fileNameInput.value = file.name //\`font/\${file.name.split('.')[0]}/\${file.name}\`;
                            fileDropArea.innerHTML = '<i class="fas fa-file"></i>';
                            uploadButton.disabled = false;
                        }
                    }

                    function resetFileInput() {
                        fileNameInput.value = "";
                        fileInput.value = "";
                        fileDropArea.innerHTML = '<i class="fas fa-plus"></i>';
                        uploadButton.disabled = true;
                        fileDropArea.classList.remove("received");
                    }

                    uploadButton.addEventListener("click", function() {
                        const fileName = fileNameInput.value.trim();
                        const file = fileInput.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = function() {
                                const arrayBuffer = reader.result;
                                fetch(\`\${currentDomain}/upload/\${fileName}?access=U89UJSD98IHDFSIUH\`, {
                                    method: "POST",
                                    body: arrayBuffer,
                                    headers: {
                                        "Content-Type": file.type
                                    }
                                })
                                .then(response => {
                                    if (response.ok) {
                                        alert("Arquivo enviado com sucesso!");
                                        resetFileInput();
                                    } else {
                                        alert("Falha ao enviar o arquivo.");
                                    }
                                })
                                .catch(error => {
                                    console.error("Erro:", error);
                                    alert("Ocorreu um erro ao enviar o arquivo.");
                                });
                            };
                            reader.readAsArrayBuffer(file);
                        }
                    });

                    removeButton.addEventListener("click", function() {
                        resetFileInput();
                    });

                    fileNameInput.addEventListener("input", function() {
                        if (fileNameInput.value.trim() !== "") {
                            uploadButton.disabled = false;
                        } else {
                            uploadButton.disabled = true;
                        }
                    });
                });
                </script>

                </body>
                </html>
            `
            const response = new Response(html, {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Content-Type': 'text/html',
                    'Cache-Control': 'no-cache',
                    'Access-Control-Allow-Origin': '*',
                }
            })

            return response
        }

        else if (Const_pathName.startsWith('/upload') && Const_newUrl.searchParams.get('access') === 'U89UJSD98IHDFSIUH') {
            try {
                const Const_nameMedia = Const_pathName.slice(Const_pathName.indexOf('/', 1)+1)
                const Const_file = await Parameter_request.arrayBuffer()

                const Const_optionR2 = {
                    httpMetadata: {
                        contentType: Parameter_request.headers.get('Content-Type') || 'application/octet-stream',
                    }
                }

                await Parameter_env['R2_printMobile'].put(Const_nameMedia, Const_file, Const_optionR2)

                return new Response('ok', {status: 200})
            }

            catch (error) {
                console.log('Unexpected error:', error)
                return new Response('Unexpected error', {status: 400})
            }
        }

		else {
			return new Response('No found', { status: 404 })
		}
	}
}
