import express from 'express';
import JSZip from 'jszip';
import multer from 'multer';

const app = express();
const upload = multer();

// In-memory session store: { sessionId: { files: [{name, buffer}], createdAt } }
const sessions = new Map();

// Clean up sessions older than 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
}, 60 * 1000);

// POST /upload — called once per SVG file from n8n loop
// Body: multipart with field "file" (binary SVG)
// Headers: x-session-id, x-file-name, x-total-files
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    const fileName  = req.headers['x-file-name'] || 'file.svg';
    const total     = parseInt(req.headers['x-total-files'] || '0', 10);

    if (!sessionId) return res.status(400).json({ error: 'Missing x-session-id header' });
    if (!req.file)  return res.status(400).json({ error: 'No file uploaded' });

    // Get or create session
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { files: [], total, createdAt: Date.now() });
    }

    const session = sessions.get(sessionId);
    const name = fileName.replace(/\.[^.]+$/, '.svg');
    session.files.push({ name, buffer: req.file.buffer });

    console.log(`[${sessionId}] received ${session.files.length}/${session.total}: ${name}`);

    res.json({
      received: session.files.length,
      total: session.total,
      done: session.files.length >= session.total
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /zip — called once after all files uploaded
// Body: { sessionId }
// Returns: zip file as binary
app.use(express.json());
app.post('/zip', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found or expired' });
    if (!session.files.length) return res.status(400).json({ error: 'No files in session' });

    console.log(`[${sessionId}] zipping ${session.files.length} files`);

    const zip = new JSZip();
    for (const f of session.files) {
      zip.file(f.name, f.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    // Clean up session
    sessions.delete(sessionId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="svgs.zip"');
    res.setHeader('Content-Length', zipBuffer.length);
    res.send(zipBuffer);

  } catch (err) {
    console.error('ZIP error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/health', (_, res) => res.json({ ok: true, sessions: sessions.size }));

app.listen(process.env.PORT || 3000, () => {
  console.log(`SVG ZIP service running on port ${process.env.PORT || 3000}`);
});
