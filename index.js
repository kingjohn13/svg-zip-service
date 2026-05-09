import express from 'express';
import JSZip from 'jszip';

const app = express();

// Allow JSON up to ~50 MB
app.use(express.json({ limit: '50mb' }));

app.post('/zip', async (req, res) => {
  try {
    const { files } = req.body;  // [{ name, dataBase64 }]
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const zip = new JSZip();

    for (const f of files) {
      if (!f?.name || !f?.dataBase64) continue;
      const buf = Buffer.from(f.dataBase64, 'base64');
      zip.file(f.name, buf);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    res.json({
      zipBase64: zipBuffer.toString('base64'),
      count: files.length
    });
  } catch (err) {
    console.error('ZIP error:', err);
    res.status(500).json({ error: 'ZIP creation failed', details: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`SVG ZIP service listening on ${port}`);
});