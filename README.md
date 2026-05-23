# Codex Apps

Root landing page for small AI apps.

## Structure

- `/index.html`: app directory and introduction page
- `/legofy/index.html`: LEGOfy web app UI
- `/api/legofy.js`: secure Vercel serverless endpoint for image editing

## LEGOfy

Upload a photo, keep the main subject realistic, and transform the rest of the scene into a LEGO-style world.

## Deployment

Deploy on Vercel and add this environment variable:

```text
OPENAI_API_KEY=your_openai_api_key
```

Then open:

```text
/
/legofy/
```
