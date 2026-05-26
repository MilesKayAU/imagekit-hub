# ReadyCode ImageKit — Privacy

ReadyCode ImageKit is a free, bring-your-own-key (BYOK) AI image studio that lives in the browser side panel. This page explains, in plain English, what the extension does with your data.

_Last updated: 2026-05-26._

## Single purpose

ReadyCode ImageKit has one purpose: let you generate and respin AI images from the active tab using your own AI provider key, and save those images to your private ReadyCode library. Every permission and every line of code in this extension serves that single purpose.

## Chrome Web Store user-data certification

Per the Chrome Web Store Developer Program Policies and the Limited Use requirements, we certify the following about ReadyCode ImageKit:

- We **do not sell** user data to third parties.
- We **do not transfer** user data to third parties for purposes unrelated to the extension's single purpose.
- We **do not use or transfer** user data for advertising, including retargeting, personalised or interest-based advertising.
- We **do not use or transfer** user data to determine creditworthiness or for lending purposes.
- We **do not use** user data, prompts, or generated images to train any AI model.
- All transfers of user data are encrypted in transit (HTTPS/TLS).

## What ImageKit reads

ImageKit only reads data when **you take an action** inside the side panel or context menu:

- when you click **Grab visible tab** — a single screenshot of the visible area of the active tab;
- when you right-click an image and pick **Grab this image with ReadyCode ImageKit** — the URL of that image;
- when you paste an image URL or upload a file from your device;
- when you sign in to ReadyCode in another tab — a short-lived access token used to authenticate calls to ReadyCode.

ImageKit does **not** read pages in the background, follow you around the web, or capture anything before you act.

## Data categories collected (Chrome Web Store taxonomy)

| Category | Collected? | What & why |
|---|---|---|
| Personally identifiable information | No | None. |
| Health information | No | — |
| Financial and payment information | No | Your AI provider bills you directly; we never see card data. |
| Authentication information | Yes | A short-lived ReadyCode session token, stored locally in `chrome.storage.local`, used only to authenticate calls to ReadyCode. |
| Personal communications | No | — |
| Location | No | — |
| Web history | No | — |
| User activity | No | We do not log clicks, scrolls, or page views. |
| Website content | Yes — only on explicit action | The single screenshot or image URL you choose when you click **Grab visible tab** or use the right-click action. |

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

## Data retention and deletion

- **Session tokens** clear when you sign out at readycode.ai, remove the extension, or clear the extension's local storage.
- **Saved images** stay in your private library until you delete them at <https://readycode.ai/imagekit/library>.
- **Account deletion**: email <privacy@readycode.ai> and we will delete your account, library, and any associated BYOK records within 30 days.

## What ImageKit will not do

- It will not run on a page until you click an action.
- It will not capture or transmit images you did not explicitly select.
- It will not sell, share, or use your prompts or images to train any model.
- It will not bypass the per-provider rate limits or terms of your BYOK provider.
- It will not request `<all_urls>`, `webRequest`, `notifications`, `alarms`, or `cookies`.

## Permissions, and why each is needed

- **storage** — persist UI state and the linked ReadyCode session token locally.
- **sidePanel** — render the ImageKit UI in the browser side panel.
- **activeTab** — grab a single screenshot of the visible area of the active tab only when you click **Grab visible tab**.
- **scripting** — inject a one-shot capture script for the **Grab visible tab** action.
- **contextMenus** — add the "Grab this image with ReadyCode ImageKit" right-click entry.
- **tabs** — open the ReadyCode library tab after you save an image.
- **host permissions** for `readycode.ai`, `*.readycode.ai`, and the ReadyCode Supabase project — required to call the ReadyCode edge function that brokers the BYOK request and to read your session.

## Account requirement

ImageKit requires a free ReadyCode account so the extension can resolve which BYOK provider to use and so saved images can be associated with your library. Account signup is at <https://readycode.ai/signup>.

## Contact

privacy@readycode.ai
