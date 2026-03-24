import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  try {
    // Initialize Firebase Admin
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (getApps().length === 0) {
        initializeApp({
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
        console.log('Firebase Admin initialized with bucket:', firebaseConfig.storageBucket);
      }
    } else {
      console.warn('firebase-applet-config.json not found, skipping admin initialization');
    }

    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    const PORT = 3000;

    // Set global prefix for all API routes
    app.setGlobalPrefix('api');

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      
      // Only use vite middleware for non-api routes
      app.use((req, res, next) => {
        if (req.url.startsWith('/api')) {
          next();
        } else {
          vite.middlewares(req, res, next);
        }
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      const express = await import('express');
      const expressApp = app.getHttpAdapter().getInstance();
      expressApp.use(express.default.static(distPath));
      
      expressApp.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    await app.listen(PORT, '0.0.0.0');
    console.log(`Server running on http://localhost:${PORT}`);
  } catch (error) {
    console.error('CRITICAL: Bootstrap failed:', error);
    process.exit(1);
  }
}

bootstrap();
