import express, { Request, Response } from 'express';
import admin from 'firebase-admin';
import multer from 'multer';

interface MulterRequest extends Request {
  file?: any;
}

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  }
});

let bucket: any;
try {
  bucket = admin.storage().bucket();
  console.log('[Storage] Bucket initialized:', bucket.name);
} catch (error) {
  console.error('[Storage] CRITICAL: Failed to initialize bucket:', error);
}

// Endpoint de teste para verificar se o storage está configurado
router.get('/health', (req: Request, res: Response) => {
  if (!bucket) {
    return res.status(500).json({ 
      status: 'error',
      message: 'Bucket not initialized',
      env: {
        hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
        hasStorageBucket: !!process.env.FIREBASE_STORAGE_BUCKET,
        storageBucketValue: process.env.FIREBASE_STORAGE_BUCKET
      }
    });
  }
  
  res.json({ 
    status: 'ok',
    bucketName: bucket.name,
    env: {
      hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasStorageBucket: !!process.env.FIREBASE_STORAGE_BUCKET,
      storageBucketValue: process.env.FIREBASE_STORAGE_BUCKET
    }
  });
});

router.post('/upload', upload.single('file'), async (req: MulterRequest, res: Response) => {
  try {
    if (!bucket) {
      console.error('[Storage API] Bucket not initialized');
      return res.status(500).json({ error: 'Storage não configurado corretamente' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const { path } = req.body;
    if (!path) {
      return res.status(400).json({ error: 'Caminho não especificado' });
    }

    console.log('[Storage API] Uploading file to:', path);
    console.log('[Storage API] File:', req.file.originalname, req.file.size, 'bytes');
    console.log('[Storage API] Content-Type:', req.file.mimetype);

    const file = bucket.file(path);
    const stream = file.createWriteStream({
      metadata: {
        contentType: req.file.mimetype,
      },
    });

    stream.on('error', (error) => {
      console.error('[Storage API] Upload stream error:', error);
      console.error('[Storage API] Error details:', JSON.stringify(error, null, 2));
      res.status(500).json({ 
        error: 'Erro no upload', 
        details: error.message || 'Erro desconhecido'
      });
    });

    stream.on('finish', async () => {
      try {
        console.log('[Storage API] File uploaded, making public...');
        await file.makePublic();

        const downloadURL = `https://storage.googleapis.com/${bucket.name}/${path}`;
        console.log('[Storage API] Upload successful! Download URL:', downloadURL);
        res.json({ downloadURL });
      } catch (error: any) {
        console.error('[Storage API] Error making file public:', error);
        console.error('[Storage API] Error details:', error.message, error.code);
        res.status(500).json({ 
          error: 'Erro ao tornar arquivo público',
          details: error.message || 'Erro desconhecido'
        });
      }
    });

    stream.end(req.file.buffer);
  } catch (error: any) {
    console.error('[Storage API] Erro geral ao fazer upload:', error);
    console.error('[Storage API] Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Erro ao fazer upload',
      details: error.message || 'Erro desconhecido'
    });
  }
});

router.delete('/delete', async (req: Request, res: Response) => {
  try {
    if (!bucket) {
      console.error('[Storage API] Bucket not initialized');
      return res.status(500).json({ error: 'Storage não configurado corretamente' });
    }

    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'URL da imagem não especificada' });
    }

    const urlParts = imageUrl.split('/');
    const fileName = urlParts.slice(-2).join('/');

    console.log('[Storage API] Deleting file:', fileName);
    console.log('[Storage API] Original URL:', imageUrl);

    try {
      const file = bucket.file(fileName);
      await file.delete();
      console.log('[Storage API] File deleted successfully');
    } catch (deleteError: any) {
      // Se o arquivo não existe (404), considerar como sucesso
      if (deleteError.code === 404) {
        console.log('[Storage API] File not found (already deleted), considering as success');
      } else {
        throw deleteError; // Re-throw outros erros
      }
    }

    res.json({ message: 'Imagem deletada com sucesso' });
  } catch (error: any) {
    console.error('[Storage API] Erro ao deletar imagem:', error);
    console.error('[Storage API] Error details:', error.message, error.code);
    res.status(500).json({ 
      error: 'Erro ao deletar imagem',
      details: error.message || 'Erro desconhecido'
    });
  }
});

export default router;
