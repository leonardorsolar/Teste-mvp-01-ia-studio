import { Controller, Post, UseInterceptors, UploadedFile, HttpException, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { getStorage } from 'firebase-admin/storage';

@Controller('upload')
export class UploadController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: any) {
    if (!file) {
      throw new HttpException('No file uploaded', HttpStatus.BAD_REQUEST);
    }

    try {
      const bucket = getStorage().bucket();
      const fileName = `screens/${Date.now()}-${file.originalname}`;
      const blob = bucket.file(fileName);
      const blobStream = blob.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
      });

      return new Promise((resolve, reject) => {
        blobStream.on('error', (err) => {
          console.error('Upload error:', err);
          reject(new HttpException('Upload failed', HttpStatus.INTERNAL_SERVER_ERROR));
        });

        blobStream.on('finish', async () => {
          try {
            // Try to make the file public
            await blob.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            resolve({ url: publicUrl });
          } catch (err) {
            console.warn('Error making file public, using signed URL fallback:', err);
            // Fallback to a long-lived signed URL if public access fails
            try {
              const [url] = await blob.getSignedUrl({
                action: 'read',
                expires: '03-01-2500',
              });
              resolve({ url });
            } catch (signedUrlErr) {
              console.error('Signed URL generation failed:', signedUrlErr);
              reject(new HttpException('Failed to generate access URL', HttpStatus.INTERNAL_SERVER_ERROR));
            }
          }
        });

        blobStream.end(file.buffer);
      });
    } catch (error) {
      console.error('Server upload error:', error);
      throw new HttpException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
