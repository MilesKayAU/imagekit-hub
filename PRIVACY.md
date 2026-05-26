# ReadyCode ImageKit — Privacy

ReadyCode ImageKit is a free, bring-your-own-key (BYOK) AI image studio that lives in the browser side panel. This page explains, in plain English, what the extension does with your data.

## What ImageKit reads

ImageKit only reads data when **you take an action** inside the side panel or context menu:

- when you click **Grab visible tab** — a single screenshot of the visible area of the active tab;
- when you right-click an image and pick **Grab this image with ReadyCode ImageKit** — the URL of that image;
- when you paste an image URL or upload a file from your device;
- when you sign in to ReadyCode in another tab — a short-lived access token used to authenticate calls to ReadyCode.

ImageKit does **not** read pages in the background, follow you around the web, or capture anything before you act.

## What ImageKit sends

When you press **Generate** or **Respin**, the following are sent to ReadyCode:

- the source image (URL or upload) and your text prompt;
- your selected style preset and target provider/model id;
- your ReadyCode session token (so the request can be billed to your BYOK provider on file).

ReadyCode forwards the prompt and image to the AI provider whose API key you stored in your ReadyCode account (your BYOK key). **ReadyCode never pays for image inference** — your provider bills you directly.

ImageKit does **not** send page content, browsing history, form data, passwords, or any tab content beyond the image you explicitly chose.

## Where data is stored

- **BYOK API keys** are stored encrypted in your ReadyCode account vault, never in the extension or in `chrome.storage`.
- **Session tokens** are stored in `chrome.storage.local` on this device only and can be cleared by signing out at readycode.ai or removing the extension.
- **Generated images you save** live in a private Supabase Storage bucket scoped to your account at `readycode.ai/imagekit/library`.
- **No image content is shared with other ReadyCode users.**

## What ImageKit will not do

- It will not run on a page until you click an action.
- It will not capture or transmit images you did not explicitly select.
- It will not sell, share, or use your prompts or images to train any model.
- It will not bypass the per-provider rate limits or terms of your BYOK provider.

## Permissions, and why each is needed

- **storage** — persist UI state and the linked ReadyCode session token locally.
- **sidePanel** — render the ImageKit UI in the browser side panel.
- **activeTab** — grab a single screenshot of the visible area of the active tab only when you click **Grab visible tab**.
- **scripting** — inject a one-shot capture script for the **Grab visible tab** action.
- **contextMenus** — add the "Grab this image with ReadyCode ImageKit" right-click entry.
- **tabs** — open the ReadyCode library tab after you save an image.
- **host permissions** for `readycode.ai`, `*.readycode.ai`, and the ReadyCode Supabase project — required to call the ReadyCode edge function that brokers the BYOK request and to read your session.

ImageKit does **not** request `<all_urls>`, `webRequest`, `notifications`, `alarms`, or `cookies`.

## Account requirement

ImageKit requires a free ReadyCode account so the extension can resolve which BYOK provider to use and so saved images can be associated with your library. Account signup is at <https://readycode.ai/signup>.

## Contact

privacy@readycode.ai
