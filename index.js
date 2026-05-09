import express from 'express';
import JSZip from 'jszip';

const app = express();
app.use(express.json({ limit: '50mb' })); // important

app.post('/zip', async (req, res) => {
  try {
    console.log('Received /zip request');           // <--- add this
    console.log('Body keys:', Object.keys(req.body || {}));

    const { files } = req.body;
    if (!Array.isArray(files) || !files.length) {
      console.log('No files provided');
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
