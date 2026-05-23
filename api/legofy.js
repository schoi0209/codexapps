export const config = {
  api: {
    bodyParser: false
  }
};

function readMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        if (!boundaryMatch) throw new Error('Missing multipart boundary.');
        const boundary = `--${boundaryMatch[1]}`;
        const parts = buffer.toString('binary').split(boundary).slice(1, -1);
        const fields = {};
        let file = null;

        for (const part of parts) {
          const [rawHeaders, rawBody] = part.split('\r\n\r\n');
          if (!rawHeaders || !rawBody) continue;
          const nameMatch = rawHeaders.match(/name="([^"]+)"/);
          if (!nameMatch) continue;
          const name = nameMatch[1];
          const filenameMatch = rawHeaders.match(/filename="([^"]*)"/);
          const typeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
          let body = Buffer.from(rawBody.replace(/\r\n$/, ''), 'binary');

          if (filenameMatch) {
            file = {
              field: name,
              filename: filenameMatch[1] || 'upload.png',
              contentType: typeMatch ? typeMatch[1].trim() : 'image/png',
              buffer: body
            };
          } else {
            fields[name] = body.toString('utf8').trim();
          }
        }
        resolve({ fields, file });
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function buildPrompt(extra = '') {
  return [
    'Edit this uploaded photo into a highly detailed LEGO world.',
    'Keep the main subject as a realistic human, not LEGO. Treat the central or largest visible person as the main subject.',
    'Preserve the main subject face, body shape, pose, hair, skin tone, clothing, logos or text, and overall realistic appearance as much as possible.',
    'Transform everything else into a polished LEGO diorama: background, buildings, furniture, vehicles, plants, road, field, sky, props, objects, crowd, and environment.',
    'Any other people besides the main subject should become LEGO minifigures.',
    'Maintain the original composition, camera angle, lighting direction, and photographic drama.',
    'Add toy-like plastic texture, visible brick studs where appropriate, subtle gloss, and immersive LEGO set detail.',
    'The concept must read clearly as: one real person inside a LEGO world.',
    extra ? `Additional style instruction: ${extra}` : ''
  ].filter(Boolean).join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY 환경변수가 설정되지 않았습니다.' });
  }

  try {
    const { fields, file } = await readMultipart(req);
    if (!file) return res.status(400).json({ error: '이미지 파일이 필요합니다.' });

    const form = new FormData();
    const imageBlob = new Blob([file.buffer], { type: file.contentType });
    form.append('model', 'gpt-image-1');
    form.append('image', imageBlob, file.filename);
    form.append('prompt', buildPrompt(fields.extra));
    form.append('quality', fields.quality || 'medium');
    if (fields.size && fields.size !== 'auto') form.append('size', fields.size);

    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'OpenAI 이미지 편집 요청에 실패했습니다.' });
    }

    const b64 = data.data?.[0]?.b64_json;
    if (!b64) return res.status(502).json({ error: '이미지 결과를 받지 못했습니다.' });
    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (error) {
    return res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
}
