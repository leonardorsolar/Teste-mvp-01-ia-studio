import { Controller, Post, HttpException, HttpStatus } from '@nestjs/common';

@Controller('upload')
export class UploadController {
  @Post()
  uploadFile() {
    throw new HttpException(
      'Endpoint desativado: as imagens agora são compactadas no navegador e salvas no Firestore como Base64.',
      HttpStatus.GONE,
    );
  }
}
