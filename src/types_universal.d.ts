import { BrowserWorker } from "@cloudflare/puppeteer"
import { type BrowserWorker as BrowserWorker2 } from "@cloudflare/playwright"

export type Type_envData = {
    R2_printMobile: R2Bucket;
    Browser_printMobile: BrowserWorker2;

    Env_linkFrontend: string;
    Env_linkBackend: string;

    Env_workplace: string;
}
