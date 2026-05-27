## Goal
Fix the Video Marketing flow in the ReadyCode app/backend project so “Watch the video” no longer ends in `Couldn't analyze: HTTP 404` and instead either returns analysis or cleanly falls back to metadata mode.

## Plan
1. Inspect the ReadyCode app code that powers Video Marketing and confirm which request is fired when the user clicks `Analyze & build 8–15s storyboard`.
2. Trace the request target and compare it against the deployed backend route/function names to find the mismatch causing the 404.
3. Update the ReadyCode app/backend so the watch-video path points to the deployed BYOK analyzer endpoint and preserves the fallback contract:
   - success: `{ analysis, provider_name, model_name }`
   - soft fallback: `{ fallback: "text_only", reason }`
   - hard error: `{ error: "..." }`
4. Verify the UI handles non-200 responses correctly so unsupported/unavailable analyzer cases degrade to metadata analysis instead of surfacing a hard 404 to the user.
5. Re-test the YouTube Shorts case from the screenshot and confirm the status message becomes either a success state or the yellow fallback state, not a red HTTP 404.

## Technical details
- This repo’s packaged extension already contains the fallback logic and is version `1.0.30`.
- The screenshot behavior looks like the separate ReadyCode website/backend project is still on older code or has the analyzer route missing there.
- Likely fix areas in the ReadyCode project:
  - the Video Marketing frontend request path
  - the deployed server/edge function name and environment
  - error handling around 404 responses

## Expected outcome
The in-app Video Marketing flow works again for BYOK users, and if the analyzer is unavailable it falls back gracefully instead of failing with `HTTP 404`. 