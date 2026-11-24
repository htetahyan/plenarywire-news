import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Pages read D1 on every request (dynamic rendering), so new articles show up
// as soon as a run commits them. No incremental cache is needed.
export default defineCloudflareConfig({});
