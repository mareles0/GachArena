const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  }
});

const bucket = admin.storage().bucket();

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Caminho não especificado' });
    }

    console.log('[Storage API] Uploading file to:', path);
    console.log('[Storage API] File:', req.file.originalname, req.file.size, 'bytes');

    const file = bucket.file(path);
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    stream.on('error', (error) => {
      console.error('[Storage API] Upload error:', error);
      res.status(500).json({ error: 'Erro no upload' });
    });

    stream.on('finish', async () => {
      try {
        await file.makePublic();

        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${path}`;
        console.log('[Storage API] Upload successful! Download URL:', downloadURL);
        res.json({ downloadURL });
      } catch (error) {
        console.error('[Storage API] Error making file public:', error);
        res.status(500).json({ error: 'Erro ao tornar arquivo público' });
      }
    });

    stream.end(req.file.buffer);
  } catch (error) {
    console.error('[Storage API] Erro ao fazer upload:', error);
    res.status(500).json({ error: 'Erro ao fazer upload' });
  }
});

router.delete('/delete', async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem não especificada' });
    }

    const urlParts = imageUrl.split('/');
    const fileName = urlParts.slice(-2).join('/');

    console.log('[Storage API] Deleting file:', fileName);

    const file = bucket.file(fileName);
    await file.delete();

    res.json({ message: 'Imagem deletada com sucesso' });
  } catch (error) {
    console.error('[Storage API] Erro ao deletar imagem:', error);
    res.status(500).json({ error: 'Erro ao deletar imagem' });
  }
});

module.exports = router;